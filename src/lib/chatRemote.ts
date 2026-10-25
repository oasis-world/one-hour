import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from './supabaseClient'
import { isSupabaseConfigured } from './supabaseConfig'
import type { ChatMessage, PresenceMember } from './chatTypes'

/**
 * Supabase remote layer for the global chat room, ported from oasis-game's
 * sceneChat remote: history in the `chat_messages` table, realtime INSERT /
 * DELETE via postgres_changes, who-is-here via channel presence, images in
 * the public `chat-images` storage bucket. The vendor SDK stays behind this
 * module — UI code only sees the sync facade.
 */

const MESSAGES_TABLE = 'chat_messages'
const IMAGES_BUCKET = 'chat-images'
export const CHAT_PAGE_SIZE = 40

export interface ChatCursor {
  createdAt: string
  id: string
}

export interface ChatPage {
  messages: ChatMessage[]
  hasMore: boolean
}

export type RoomStatus = 'joining' | 'open' | 'closed' | 'error'

export interface RoomCallbacks {
  /** Server-confirmed message (own echo included — dedupe by id upstream). */
  onMessage: (message: ChatMessage) => void
  /** A row was deleted on any client (expiry purge or author delete). */
  onDeleted: (id: string) => void
  onPresence: (members: PresenceMember[]) => void
  onStatus: (status: RoomStatus) => void
}

export interface RoomHandle {
  track(identity: { userId: string; displayName: string; avatarUrl: string | null }): void
  send(draft: {
    id: string
    content: string
    displayName: string
    imageBlob?: Blob
  }): Promise<{ ok: true } | { ok: false; error: 'network' | 'rejected' }>
  deleteMessage(id: string): Promise<{ ok: true } | { ok: false; error: 'network' | 'rejected' }>
  leave(): void
}

interface MessageRow {
  id: string
  user_id: string
  display_name: string
  content: string
  image_url: string | null
  created_at: string
}

export const ROOM_TOPIC = 'chat:global'

async function chatContext(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const client = await getSupabaseClient()
    const { data } = await client.auth.getSession()
    if (!data.session?.user?.id) return null
    return client
  } catch {
    return null
  }
}

/** Newest page of live (unexpired) messages, oldest → newest. */
export async function fetchChatPage(before?: ChatCursor): Promise<ChatPage | null> {
  const ctx = await chatContext()
  if (!ctx) return null
  try {
    let query = ctx
      .from(MESSAGES_TABLE)
      .select('id, user_id, display_name, content, image_url, created_at')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
    if (before) {
      query = query.or(
        `created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id})`,
      )
    }
    const { data, error } = await query.limit(CHAT_PAGE_SIZE + 1)
    if (error) return null
    const rows = (data ?? []) as MessageRow[]
    const hasMore = rows.length > CHAT_PAGE_SIZE
    return {
      messages: rows.slice(0, CHAT_PAGE_SIZE).map(rowToMessage),
      hasMore,
    }
  } catch {
    return null
  }
}

export async function joinChatRoom(options: {
  presenceKey: string
  onMessage: RoomCallbacks['onMessage']
  onDeleted: RoomCallbacks['onDeleted']
  onPresence: RoomCallbacks['onPresence']
  onStatus: RoomCallbacks['onStatus']
}): Promise<RoomHandle | null> {
  const ctx = await chatContext()
  if (!ctx) return null

  // StrictMode / remount race the previous leave(): make sure the topic is
  // free first — attaching callbacks to a still-subscribed channel throws.
  const realtimeTopic = `realtime:${ROOM_TOPIC}`
  const stale = ctx.getChannels().find((existing) => existing.topic === realtimeTopic)
  if (stale) {
    try {
      await ctx.removeChannel(stale)
    } catch {
      // Already unsubscribed by the racing leave().
    }
  }

  let channel: ReturnType<typeof ctx.channel>
  try {
    channel = ctx.channel(ROOM_TOPIC, {
      // Per-user key: reconnects overwrite this player's presence entry
      // instead of stacking a duplicate one.
      config: { presence: { key: options.presenceKey } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePayload>()
        // One member per userId, keeping the freshest track.
        const latestByUser = new Map<string, PresencePayload>()
        for (const entries of Object.values(state)) {
          for (const entry of entries) {
            if (!entry?.userId) continue
            const kept = latestByUser.get(entry.userId)
            if (!kept || entry.enteredAt > kept.enteredAt) {
              latestByUser.set(entry.userId, entry)
            }
          }
        }
        const members: PresenceMember[] = [...latestByUser.values()]
          .sort((a, b) => a.enteredAt - b.enteredAt)
          .map((entry) => ({
            userId: entry.userId,
            displayName: entry.displayName,
            avatarUrl: entry.avatarUrl ?? null,
          }))
        options.onPresence(members)
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: MESSAGES_TABLE },
        (payload) => {
          const row = payload.new as MessageRow
          if (row?.id) options.onMessage(rowToMessage(row))
        },
      )
      .on(
        'postgres_changes',
        // No filter: with the default replica identity the DELETE record
        // only carries the PK, and a filtered subscription never fires.
        { event: 'DELETE', schema: 'public', table: MESSAGES_TABLE },
        (payload) => {
          const old = payload.old as { id?: string } | null
          if (old?.id) options.onDeleted(old.id)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') options.onStatus('open')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') options.onStatus('error')
        else if (status === 'CLOSED') options.onStatus('closed')
      })
  } catch {
    options.onStatus('error')
    return null
  }

  return {
    track(identity) {
      void channel.track({
        userId: identity.userId,
        displayName: identity.displayName,
        avatarUrl: identity.avatarUrl,
        enteredAt: Date.now(),
      })
    },
    async send(draft) {
      try {
        const { data } = await ctx.auth.getSession()
        const uid = data.session?.user?.id
        if (!uid) return { ok: false, error: 'rejected' }
        let imageUrl: string | null = null
        if (draft.imageBlob) {
          const path = `${uid}/${draft.id}.jpg`
          const { error: uploadError } = await ctx.storage
            .from(IMAGES_BUCKET)
            .upload(path, draft.imageBlob, {
              contentType: 'image/jpeg',
              upsert: true,
            })
          if (uploadError) {
            return { ok: false, error: isNetworkError(uploadError) ? 'network' : 'rejected' }
          }
          imageUrl = ctx.storage.from(IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
        }
        const { error } = await ctx.from(MESSAGES_TABLE).insert({
          id: draft.id,
          user_id: uid,
          display_name: draft.displayName,
          content: draft.content || '',
          image_url: imageUrl,
        })
        if (error) return { ok: false, error: 'rejected' }
        return { ok: true }
      } catch {
        return { ok: false, error: 'network' }
      }
    },
    async deleteMessage(id) {
      try {
        const { error } = await ctx.from(MESSAGES_TABLE).delete().eq('id', id)
        if (error) return { ok: false, error: 'rejected' }
        return { ok: true }
      } catch {
        return { ok: false, error: 'network' }
      }
    },
    leave() {
      // Untrack first so the server drops this presence immediately.
      void (async () => {
        try {
          await channel.untrack()
        } catch {
          // Network already gone.
        }
        try {
          await ctx.removeChannel(channel)
        } catch {
          // Racing leave() already removed it.
        }
      })()
    },
  }
}

interface PresencePayload {
  userId: string
  displayName: string
  avatarUrl?: string | null
  enteredAt: number
}

function rowToMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    content: row.content,
    at: new Date(row.created_at).getTime(),
    serverCreatedAt: row.created_at,
    imageUrl: row.image_url ?? null,
  }
}

function isNetworkError(error: { message?: string }): boolean {
  const msg = (error.message ?? '').toLowerCase()
  return /fetch|network|timeout|failed to fetch/.test(msg)
}
