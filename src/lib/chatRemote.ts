import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from './supabaseClient'
import { isSupabaseConfigured } from './supabaseConfig'
import { withTimeout } from './withTimeout'
import type { ChatMessage, MessageReply, PresenceMember } from './chatTypes'
import type { RoomReactionChange, RoomReactionRecord } from './chatReactions'
import { fetchRoomReactionSnapshot, persistRoomReaction } from './chatReactionRemote'

/**
 * Supabase remote layer for the global chat room, ported from oasis-game's
 * sceneChat remote: history in `chat_messages`, realtime message/reaction
 * changes via postgres_changes, who-is-here via presence, and images in the
 * public `chat-images` bucket. The vendor SDK stays behind this module — UI
 * code only sees the sync facade.
 */

const MESSAGES_TABLE = 'chat_messages'
const REACTIONS_TABLE = 'chat_reactions'
const IMAGES_BUCKET = 'chat-images'
export const CHAT_PAGE_SIZE = 40

/**
 * A hung request (weak mobile network: sent, no response, no error) must
 * not hold the outbox flush lock forever — one stuck photo would pin its
 * entry as pending and block every later send. Timeouts feed the normal
 * network-error retry path instead.
 */
const UPLOAD_TIMEOUT_MS = 60_000
const INSERT_TIMEOUT_MS = 30_000

/** Clients refresh their presence stamp on this cadence. */
const PRESENCE_HEARTBEAT_MS = 60_000
/**
 * A member whose stamp is staler than this is a phantom: the client died
 * without the realtime server noticing (kill / crash), and the entry
 * would otherwise haunt the online list until a server restart. The
 * tradeoff is clock skew — a device >3min fast would ghost itself; NTP
 * keeps real devices within seconds.
 */
const PRESENCE_GHOST_AFTER_MS = 3 * 60_000

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
  onReactionSnapshot: (reactions: RoomReactionRecord[]) => void
  onReaction: (change: RoomReactionChange) => void
  onPresence: (members: PresenceMember[]) => void
  onStatus: (status: RoomStatus) => void
}

export interface RoomHandle {
  track(identity: {
    userId: string
    displayName: string
    avatar: { style: string; seed: string } | null
    avatarUrl: string | null
    role: string
    profileExpiresAt: number | null
  }): void
  send(draft: {
    id: string
    content: string
    replyTo?: MessageReply | null
    displayName: string
    avatar?: { style: string; seed: string }
    avatarUrl?: string | null
    imageBlob?: Blob
  }): Promise<{ ok: true } | { ok: false; error: 'network' | 'rejected' }>
  /** Author deletes one own message: dissolve here, purge the cloud row
   *  and, through the storage API (SQL deletes on storage.objects are
   *  platform-blocked), the photo object under the author's folder. */
  deleteMessage(id: string, imagePath?: string | null): Promise<{ ok: true } | { ok: false; error: 'network' | 'rejected' }>
  updateMessage(id: string, content: string): Promise<{ ok: true } | { ok: false; error: 'network' | 'rejected' }>
  toggleReaction(messageId: string, emoji: string, active: boolean): Promise<boolean>
  leave(): void
}

interface MessageRow {
  id: string
  user_id: string
  display_name: string
  avatar_style: string | null
  avatar_seed: string | null
  avatar_url: string | null
  content: string
  reply_to?: MessageReply | null
  image_url: string | null
  created_at: string
  edited_at?: string | null
}

interface ReactionRow {
  message_id: string
  user_id: string
  emoji: string
}

export const ROOM_TOPIC = 'chat:global'

/** Set once the RPC answers 403/404 — schema not migrated; stop calling. */
let purgeRpcAvailable = true

/**
 * Safety net for projects where the pg_cron purge is not scheduled: the
 * function is SECURITY DEFINER and granted to every authenticated player,
 * so any online client can sweep the whole room's expired rows (and
 * orphaned photos). Best effort — never blocks the caller. A 403/404 (or
 * the function missing) disables the fallback for the session instead of
 * hammering the console every cycle.
 */
export async function purgeExpiredRemote(): Promise<void> {
  if (!purgeRpcAvailable) return
  const ctx = await chatContext()
  if (!ctx) return
  try {
    const { error } = await ctx.rpc('purge_expired_chat_messages')
    // 403/404 (HTTP) and 42501 (permission denied) are permanent states —
    // retrying every cycle only hammers the console.
    if (
      error &&
      (error.code === '403' || error.code === '404' || error.code === '42501' ||
        /permission denied|does not exist/i.test(error.message ?? ''))
    ) {
      purgeRpcAvailable = false
    }
  } catch {
    // Network hiccup: pg_cron remains the primary sweeper.
  }
}

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
      // '*' rather than an explicit list: the row picks up the avatar
      // columns once the schema migration runs, without breaking before.
      .select('*')
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
  onReactionSnapshot: RoomCallbacks['onReactionSnapshot']
  onReaction: RoomCallbacks['onReaction']
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
  let roomClosed = false
  let reactionSnapshotGeneration = 0
  let reactionSnapshotReady = false
  let bufferedReactionChanges: RoomReactionChange[] = []

  const receiveReaction = (change: RoomReactionChange) => {
    if (roomClosed) return
    if (reactionSnapshotReady) options.onReaction(change)
    else bufferedReactionChanges.push(change)
  }

  try {
    channel = ctx.channel(ROOM_TOPIC, {
      // Per-user key: reconnects overwrite this player's presence entry
      // instead of stacking a duplicate one.
      config: { presence: { key: options.presenceKey } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePayload>()
        const now = Date.now()
        // One member per userId, keeping the freshest track — and hiding
        // phantoms whose client stopped refreshing its stamp.
        const latestByUser = new Map<string, PresencePayload>()
        for (const entries of Object.values(state)) {
          for (const entry of entries) {
            if (!entry?.userId) continue
            if (now - entry.enteredAt > PRESENCE_GHOST_AFTER_MS) continue
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
            avatarStyle: entry.avatarStyle ?? null,
            avatarSeed: entry.avatarSeed ?? null,
            avatarUrl: entry.avatarUrl ?? null,
            role: entry.role ?? '',
            profileExpiresAt: entry.profileExpiresAt ?? null,
            enteredAt: entry.enteredAt,
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
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: MESSAGES_TABLE },
        (payload) => {
          const row = payload.new as MessageRow
          if (row?.id) options.onMessage(rowToMessage(row))
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: REACTIONS_TABLE },
        (payload) => {
          const row = payload.new as ReactionRow
          if (row?.message_id && row.user_id && row.emoji) {
            receiveReaction({
              messageId: row.message_id,
              userId: row.user_id,
              emoji: row.emoji,
              active: true,
            })
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: REACTIONS_TABLE },
        (payload) => {
          const row = payload.old as Partial<ReactionRow> | null
          if (row?.message_id && row.user_id && row.emoji) {
            receiveReaction({
              messageId: row.message_id,
              userId: row.user_id,
              emoji: row.emoji,
              active: false,
            })
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          options.onStatus('open')
          const generation = ++reactionSnapshotGeneration
          reactionSnapshotReady = false
          bufferedReactionChanges = []
          void fetchRoomReactionSnapshot(ctx).then((snapshot) => {
            if (roomClosed || generation !== reactionSnapshotGeneration) return
            if (snapshot) options.onReactionSnapshot(snapshot)
            for (const change of bufferedReactionChanges) options.onReaction(change)
            bufferedReactionChanges = []
            reactionSnapshotReady = true
          })
        }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') options.onStatus('error')
        else if (status === 'CLOSED') options.onStatus('closed')
      })
  } catch {
    options.onStatus('error')
    return null
  }

  /** Latest tracked identity — re-sent by the heartbeat to keep the
   *  presence stamp fresh (phantom pruning reads it). */
  let lastIdentity: Parameters<RoomHandle['track']>[0] | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null

  return {
    track(identity) {
      lastIdentity = identity
      // One heartbeat per channel: every minute the player re-announces
      // itself, so peers can tell a live tab from a phantom.
      if (!heartbeat) {
        heartbeat = setInterval(() => {
          if (!lastIdentity) return
          void channel.track({
            userId: lastIdentity.userId,
            displayName: lastIdentity.displayName,
            avatarStyle: lastIdentity.avatar?.style ?? null,
            avatarSeed: lastIdentity.avatar?.seed ?? null,
            avatarUrl: lastIdentity.avatarUrl,
            role: lastIdentity.role,
            profileExpiresAt: lastIdentity.profileExpiresAt,
            enteredAt: Date.now(),
          })
        }, PRESENCE_HEARTBEAT_MS)
      }
      void channel.track({
        userId: identity.userId,
        displayName: identity.displayName,
        avatarStyle: identity.avatar?.style ?? null,
        avatarSeed: identity.avatar?.seed ?? null,
        avatarUrl: identity.avatarUrl,
        role: identity.role,
        profileExpiresAt: identity.profileExpiresAt,
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
          const { error: uploadError } = await withTimeout(
            ctx.storage
              .from(IMAGES_BUCKET)
              .upload(path, draft.imageBlob, {
                contentType: 'image/jpeg',
                upsert: true,
              }),
            UPLOAD_TIMEOUT_MS,
          )
          if (uploadError) {
            return { ok: false, error: isNetworkError(uploadError) ? 'network' : 'rejected' }
          }
          imageUrl = ctx.storage.from(IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
        }
        const base = {
          id: draft.id,
          user_id: uid,
          display_name: draft.displayName,
          content: draft.content || '',
          image_url: imageUrl,
          reply_to: draft.replyTo ?? null,
        }
        let payloadBase: Omit<typeof base, 'reply_to'> | typeof base = base
        let { error } = await withTimeout(
          ctx.from(MESSAGES_TABLE).insert({
            ...base,
            avatar_style: draft.avatar?.style ?? null,
            avatar_seed: draft.avatar?.seed ?? null,
            avatar_url: draft.avatarUrl ?? null,
          }),
          INSERT_TIMEOUT_MS,
        )
        if (error && isMissingReplyColumnError(error)) {
          payloadBase = {
            id: base.id,
            user_id: base.user_id,
            display_name: base.display_name,
            content: base.content,
            image_url: base.image_url,
          }
          const retry = await withTimeout(
            ctx.from(MESSAGES_TABLE).insert({
              ...payloadBase,
              avatar_style: draft.avatar?.style ?? null,
              avatar_seed: draft.avatar?.seed ?? null,
              avatar_url: draft.avatarUrl ?? null,
            }),
            INSERT_TIMEOUT_MS,
          )
          error = retry.error
        }
        if (error && isMissingColumnError(error)) {
          // Schema not migrated yet: the avatar is cosmetic, the words are
          // not — retry once without the unknown columns.
          ({ error } = await withTimeout(
            ctx.from(MESSAGES_TABLE).insert(payloadBase),
            INSERT_TIMEOUT_MS,
          ))
        }
        if (error) {
          // Our own id already on the server (first try landed, its
          // response didn't): at-least-once delivery with client-made ids
          // must count the duplicate as sent, never as failed.
          if ((error as { code?: string }).code === '23505') return { ok: true }
          return { ok: false, error: 'rejected' }
        }
        return { ok: true }
      } catch {
        return { ok: false, error: 'network' }
      }
    },
    async deleteMessage(id, imagePath) {
      try {
        const { error } = await ctx.from(MESSAGES_TABLE).delete().eq('id', id)
        if (error) return { ok: false, error: 'rejected' }
        if (imagePath) {
          // Best effort: an orphaned object is a leak, never a lost word.
          try {
            await ctx.storage.from(IMAGES_BUCKET).remove([imagePath])
          } catch {
            // Object already gone or folder policy changed.
          }
        }
        return { ok: true }
      } catch {
        return { ok: false, error: 'network' }
      }
    },
    async updateMessage(id, content) {
      try {
        const { data } = await ctx.auth.getSession()
        const uid = data.session?.user?.id
        if (!uid) return { ok: false, error: 'rejected' }
        let { error } = await withTimeout(
          ctx.from(MESSAGES_TABLE).update({ content, edited_at: new Date().toISOString() }).eq('id', id).eq('user_id', uid),
          INSERT_TIMEOUT_MS,
        )
        if (error && isMissingColumnError(error)) {
          ({ error } = await withTimeout(
            ctx.from(MESSAGES_TABLE).update({ content }).eq('id', id).eq('user_id', uid),
            INSERT_TIMEOUT_MS,
          ))
        }
        if (error) {
          return { ok: false, error: isNetworkError(error) ? 'network' : 'rejected' }
        }
        return { ok: true }
      } catch {
        return { ok: false, error: 'network' }
      }
    },
    async toggleReaction(messageId, emoji, active) {
      return persistRoomReaction(ctx, messageId, emoji, active)
    },
    leave() {
      roomClosed = true
      reactionSnapshotGeneration += 1
      // Untrack first so the server drops this presence immediately.
      if (heartbeat) {
        clearInterval(heartbeat)
        heartbeat = null
      }
      lastIdentity = null
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
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarUrl?: string | null
  role?: string
  profileExpiresAt?: number | null
  enteredAt: number
}

function rowToMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    avatarStyle: row.avatar_style ?? null,
    avatarSeed: row.avatar_seed ?? null,
    avatarUrl: row.avatar_url ?? null,
    content: row.content,
    replyTo: row.reply_to ?? null,
    at: new Date(row.created_at).getTime(),
    serverCreatedAt: row.created_at,
    imageUrl: row.image_url ?? null,
    editedAt: row.edited_at ?? null,
  }
}

function isNetworkError(error: { message?: string }): boolean {
  const msg = (error.message ?? '').toLowerCase()
  return /fetch|network|timeout|failed to fetch/.test(msg)
}

/** PostgREST "column not found" (schema not migrated to avatars yet). */
function isMissingColumnError(error: { message?: string; code?: string }): boolean {
  return (
    error.code === 'PGRST204' ||
    /could not find the .*(avatar_(style|seed|url)|edited_at) column/i.test(error.message ?? '')
  )
}

function isMissingReplyColumnError(error: { message?: string }): boolean {
  return /could not find the .*reply_to column/i.test(error.message ?? '')
}
