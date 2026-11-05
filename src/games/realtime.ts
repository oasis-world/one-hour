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

/** True while the low-level Realtime socket is alive for the given channel. */
export function isGameSocketAlive(channel: GameChannel | null | undefined): boolean {
  try {
    return Boolean(channel?.socket?.isConnected?.())
  } catch {
    return false
  }
}

/**
 * Nudge the shared Supabase Realtime socket back online after a background
 * suspend (iOS freezes timers / WebSocket). Best-effort: never throws.
 * Returns true if a reconnect was attempted.
 */
export function pokeGameSocket(client: GameClient, channel: GameChannel | null | undefined): boolean {
  try {
    const socket = (channel as unknown as { socket?: { isConnected?: () => boolean; connect?: () => void } })?.socket
    const realtime = (client as unknown as { realtime?: { isConnected?: () => boolean; connect?: () => void } })?.realtime
    const socketAlive = (() => {
      try { return socket?.isConnected?.() === true } catch { return false }
    })()
    const realtimeAlive = (() => {
      try { return realtime?.isConnected?.() === true } catch { return socketAlive }
    })()
    if (!socketAlive || !realtimeAlive) {
      try { realtime?.connect?.() } catch { /* ignore */ }
      try { socket?.connect?.() } catch { /* ignore */ }
      return true
    }
  } catch { /* ignore */ }
  return false
}

/**
 * Install foreground-wake listeners that quickly heal a dead Realtime socket.
 * Call inside the channel effect; returns an unsubscribe function for cleanup.
 *
 * When the tab returns from background (`visibilitychange` / `focus` /
 * `pageshow` / `online`) the browser may have killed the WebSocket without
 * ever firing a channel CLOSED event. The channel still looks `joined` but
 * `socket.isConnected()` is false, so `canSendGameBroadcast` rejects every
 * join/move and the UI flashes "retry" forever until the SDK's slow heartbeat
 * (≈30s) finally reconnects. This watcher pokes the socket immediately and,
 * if it is still down a beat later, triggers the caller's `onStale` retry
 * path (which tears down and re-subscribes the channel).
 */
export function installGameWakeRecovery(args: {
  getChannel: () => GameChannel | null | undefined
  getClient: () => GameClient | null | undefined
  onStale: (reason: string) => void
  shouldCheck: () => boolean
}): () => void {
  let wakeTimer: number | null = null
  let bootTimerA: number | null = null
  let bootTimerB: number | null = null
  const check = () => {
    if (document.hidden) return
    if (!args.shouldCheck()) return
    const channel = args.getChannel()
    const client = args.getClient()
    if (!channel || !client) return
    // Channel joined but socket dead — classic post-background hang.
    if (channel.state === 'joined' && !isGameSocketAlive(channel)) {
      pokeGameSocket(client, channel)
      if (wakeTimer !== null) window.clearTimeout(wakeTimer)
      wakeTimer = window.setTimeout(() => {
        wakeTimer = null
        const fresh = args.getChannel()
        if (fresh && fresh.state === 'joined' && !isGameSocketAlive(fresh) && args.shouldCheck()) {
          args.onStale('wake: socket still dead')
        }
      }, 900)
      return
    }
    // Socket alive but channel stuck in joining/closed for too long.
    if (!canSendGameBroadcast(channel) && args.shouldCheck()) {
      pokeGameSocket(client, channel)
      if (wakeTimer !== null) window.clearTimeout(wakeTimer)
      wakeTimer = window.setTimeout(() => {
        wakeTimer = null
        const fresh = args.getChannel()
        if (fresh && !canSendGameBroadcast(fresh) && args.shouldCheck()) {
          args.onStale('wake: channel still not joinable')
        }
      }, 1200)
    }
  }
  const onWake = () => {
    if (document.hidden) return
    // Two chances: immediate, then after WebSocket has had a moment to come up.
    check()
    window.setTimeout(check, 600)
  }
  document.addEventListener('visibilitychange', onWake)
  window.addEventListener('focus', onWake)
  window.addEventListener('pageshow', onWake)
  window.addEventListener('online', onWake)
  // Also check shortly after mount: a second card created while the socket is
  // already dead won't get a wake event, so probe on a timer instead.
  bootTimerA = window.setTimeout(() => {
    if (!args.shouldCheck()) return
    const ch = args.getChannel()
    const cl = args.getClient()
    if (ch && cl && !canSendGameBroadcast(ch)) check()
  }, 2500)
  bootTimerB = window.setTimeout(() => {
    if (!args.shouldCheck()) return
    const ch = args.getChannel()
    if (ch && !canSendGameBroadcast(ch)) check()
  }, 5500)
  return () => {
    document.removeEventListener('visibilitychange', onWake)
    window.removeEventListener('focus', onWake)
    window.removeEventListener('pageshow', onWake)
    window.removeEventListener('online', onWake)
    if (wakeTimer !== null) window.clearTimeout(wakeTimer)
    if (bootTimerA !== null) window.clearTimeout(bootTimerA)
    if (bootTimerB !== null) window.clearTimeout(bootTimerB)
  }
}

/** Broadcast game events only while the channel can deliver over its socket. */
export function sendGameBroadcast(channel: GameChannel | null | undefined, event: string, payload: unknown): boolean {
  if (!canSendGameBroadcast(channel)) return false
  void channel.send({ type: 'broadcast', event, payload })
  return true
}
