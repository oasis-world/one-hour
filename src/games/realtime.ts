import { getSupabaseClient } from '../lib/supabaseClient'

type GameChannel = ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>['channel']>
type GameClient = Awaited<ReturnType<typeof getSupabaseClient>>
type ReleaseSlot = () => void

const pageId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/** Distinguish tabs sharing one account so only one tab acts as a game's host. */
export function getGamePresenceKey(userId: string): string {
  return `${userId}:${pageId}`
}

/** Remove a leftover channel for this exact game before joining the topic again. */
export async function removeStaleGameChannel(client: GameClient, topic: string): Promise<void> {
  const stale = client.getChannels().filter((channel) => channel.topic === topic)
  for (const channel of stale) {
    console.warn('[game-realtime] Removing a stale channel before rejoining.', { topic, state: channel.state })
    try {
      await client.removeChannel(channel)
    } catch (error) {
      console.warn('[game-realtime] Could not remove stale channel cleanly.', { topic, error })
    }
  }
}

export function getGamePresenceUsers(channel: GameChannel | null | undefined): string[] {
  const presence = channel?.presenceState() ?? {}
  const users = new Set<string>()
  for (const metas of Object.values(presence) as Array<Array<{ userId?: unknown }>>) {
    for (const meta of metas) {
      if (typeof meta.userId === 'string') users.add(meta.userId)
    }
  }
  return [...users].sort()
}

/** Elect one live tab as host authority when the same account has many pages open. */
export function isGameHostAuthority(channel: GameChannel | null | undefined, userId: string): boolean {
  if (!channel) return false
  const presence = channel.presenceState() as Record<string, Array<{ userId?: unknown }>>
  const hostKeys = Object.entries(presence)
    .filter(([, metas]) => metas.some((meta) => meta.userId === userId))
    .map(([key]) => key)
    .sort()
  return hostKeys[0] === getGamePresenceKey(userId)
}

/** Preserve the server's close payload, which Supabase omits from CLOSED callbacks. */
export function watchGameChannelClose(
  channel: GameChannel,
  game: 'Gomoku' | 'Xiangqi' | 'Chess',
  instanceId: string,
  shouldLog: () => boolean,
): void {
  const rawChannel = channel as unknown as {
    on: (event: string, filter: Record<string, never>, callback: (payload: unknown) => void) => unknown
  }
  rawChannel.on('phx_close', {}, (payload) => {
    if (shouldLog()) console.warn(`${game} server phx_close payload`, { instanceId, payload })
  })
}

/** No limit — every game card stays connected over the single shared Supabase Realtime WebSocket. */
export function acquireGameChannelSlot(signal: AbortSignal): Promise<ReleaseSlot | null> {
  if (signal.aborted) return Promise.resolve(null)
  return Promise.resolve(() => {})
}

export function canSendGameBroadcast(channel: GameChannel | null | undefined): channel is GameChannel {
  return Boolean(channel && channel.state === 'joined' && channel.socket.isConnected())
}

/** Broadcast game events only while the channel can deliver over its socket. */
export function sendGameBroadcast(channel: GameChannel | null | undefined, event: string, payload: unknown): boolean {
  if (!canSendGameBroadcast(channel)) return false
  void channel.send({ type: 'broadcast', event, payload })
  return true
}
