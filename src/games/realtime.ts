import { getSupabaseClient } from '../lib/supabaseClient'

type GameChannel = ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>['channel']>
type ReleaseSlot = () => void

const pageId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/** Distinguish tabs sharing one account so only one tab acts as a game's host. */
export function getGamePresenceKey(userId: string): string {
  return `${userId}:${pageId}`
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

const MAX_ACTIVE_GAME_CHANNELS = 2
let activeGameChannels = 0
const waitingForGameChannel: Array<{
  signal: AbortSignal
  resolve: (release: ReleaseSlot | null) => void
  onAbort: () => void
}> = []

function createSlotRelease(): ReleaseSlot {
  let released = false
  return () => {
    if (released) return
    released = true
    activeGameChannels -= 1
    while (activeGameChannels < MAX_ACTIVE_GAME_CHANNELS && waitingForGameChannel.length > 0) {
      const next = waitingForGameChannel.shift()!
      next.signal.removeEventListener('abort', next.onAbort)
      if (next.signal.aborted) {
        next.resolve(null)
        continue
      }
      activeGameChannels += 1
      next.resolve(createSlotRelease())
    }
  }
}

/** Limit simultaneous game channels on the shared Supabase Realtime socket. */
export function acquireGameChannelSlot(signal: AbortSignal): Promise<ReleaseSlot | null> {
  if (signal.aborted) return Promise.resolve(null)
  if (activeGameChannels < MAX_ACTIVE_GAME_CHANNELS) {
    activeGameChannels += 1
    return Promise.resolve(createSlotRelease())
  }
  return new Promise((resolve) => {
    const waiter = {
      signal,
      resolve,
      onAbort: () => {
        const index = waitingForGameChannel.indexOf(waiter)
        if (index >= 0) waitingForGameChannel.splice(index, 1)
        resolve(null)
      },
    }
    waitingForGameChannel.push(waiter)
    signal.addEventListener('abort', waiter.onAbort, { once: true })
  })
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
