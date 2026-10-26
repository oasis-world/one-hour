import type { SupabaseClient } from '@supabase/supabase-js'
import { withTimeout } from './withTimeout'
import type { RoomReactionRecord } from './chatReactions'

const REACTIONS_TABLE = 'chat_reactions'
const REACTION_TIMEOUT_MS = 12_000

interface ReactionRow {
  message_id: string
  user_id: string
  emoji: string
}

/** Active reaction rows are bounded by the message FK's one-hour lifetime. */
export async function fetchRoomReactionSnapshot(
  client: SupabaseClient,
): Promise<RoomReactionRecord[] | null> {
  try {
    const { data, error } = await client
      .from(REACTIONS_TABLE)
      .select('message_id,user_id,emoji')
    if (error) return null
    return ((data ?? []) as ReactionRow[]).map((row) => ({
      messageId: row.message_id,
      userId: row.user_id,
      emoji: row.emoji,
    }))
  } catch {
    return null
  }
}

/** Persist one player's desired on/off state; Realtime distributes the row. */
export async function persistRoomReaction(
  client: SupabaseClient,
  messageId: string,
  emoji: string,
  active: boolean,
): Promise<boolean> {
  try {
    const { data } = await client.auth.getSession()
    const userId = data.session?.user?.id
    if (!userId) return false
    const request = active
      ? client.from(REACTIONS_TABLE).insert({ message_id: messageId, user_id: userId, emoji })
      : client
          .from(REACTIONS_TABLE)
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', userId)
          .eq('emoji', emoji)
    const { error } = await withTimeout(request, REACTION_TIMEOUT_MS)
    // Another device may have inserted the same user's reaction first.
    return !error || (error as { code?: string }).code === '23505'
  } catch {
    return false
  }
}
