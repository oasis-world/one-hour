import { useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseClient } from '../../lib/supabaseClient'
import { isSupabaseConfigured } from '../../lib/supabaseConfig'
import { getGamePresenceKey, removeStaleGameChannel } from '../realtime'

type SlotChannel = ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>['channel']>

export interface SlotLeaderboardPlayer {
  userId: string
  name: string
  /** Net win/loss earned on this exact card instance (never the star balance). */
  score: number
  spins: number
  avatarStyle: string
  avatarSeed: string
  avatarUrl: string | null
  isSelf: boolean
}

export interface SlotBalanceFlash { id: number; delta: number }

export interface SlotSelfInfo {
  userId: string | null
  name: string
  /** Net win/loss on this exact card instance (positive = won, negative = lost). */
  score: number
  /** Spins on this exact card instance — only players with ≥1 show up. */
  spins: number
  avatarStyle: string | null
  avatarSeed: string | null
  avatarUrl: string | null
}

interface Peer {
  name: string
  score: number
  spins: number
  avatarStyle: string
  avatarSeed: string
  avatarUrl: string | null
}

const readString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value ? value : fallback

/**
 * Leaderboard for one slot-machine instance. Everyone who has this exact
 * card open tracks their own net win/loss on this card in a presence channel
 * keyed by the instance id, so each card shows a different, self-contained board.
 * Falls back to a single local row when the backend is unavailable.
 *
 * Remote rows are intersected with the live room roster (`presentUserIds`):
 * a player whose hour ran out (or who closed the tab) drops out of the room
 * presence, and must vanish from the board even if their slot-channel entry
 * lingers. An empty roster means presence hasn't loaded, so the filter is
 * skipped rather than wiping the board.
 */
export function useSlotLeaderboard(instanceId: string, self: SlotSelfInfo, presentUserIds: readonly string[] = []) {
  const [peers, setPeers] = useState<Record<string, Peer>>({})
  const selfRef = useRef(self)
  useEffect(() => { selfRef.current = self })
  const channelRef = useRef<SlotChannel | null>(null)
  const retrackRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured() || !self.userId) return
    let cancelled = false
    const topic = `game:slot-leaderboard:${instanceId}`
    const presenceKey = getGamePresenceKey(self.userId)

    const meta = () => {
      const current = selfRef.current
      return {
        userId: current.userId,
        name: current.name,
        score: current.score,
        spins: current.spins,
        avatarStyle: current.avatarStyle ?? '',
        avatarSeed: current.avatarSeed ?? '',
        avatarUrl: current.avatarUrl ?? null,
      }
    }

    const readPresence = () => {
      const channel = channelRef.current
      if (!channel) return
      const next: Record<string, Peer> = {}
      for (const metas of Object.values(channel.presenceState() ?? {})) {
        for (const raw of metas as Array<Record<string, unknown>>) {
          const uid = raw.userId
          if (typeof uid !== 'string') continue
          const score = typeof raw.score === 'number' && Number.isFinite(raw.score)
            ? Math.trunc(raw.score)
            : 0
          const spins = typeof raw.spins === 'number' && Number.isFinite(raw.spins)
            ? Math.max(0, Math.floor(raw.spins))
            : 0
          // One account can have several tabs/devices online at once, each with
          // its own (possibly stale) score and spin count. Prefer the meta
          // with the most spins — a tab that never spun here must not veto
          // the tab that actually played, even if its score looks higher.
          const kept = next[uid]
          if (kept && (kept.spins > spins || (kept.spins === spins && kept.score >= score))) continue
          next[uid] = {
            name: readString(raw.name, 'Player'),
            score,
            spins,
            avatarStyle: readString(raw.avatarStyle),
            avatarSeed: readString(raw.avatarSeed),
            avatarUrl: typeof raw.avatarUrl === 'string' ? raw.avatarUrl : null,
          }
        }
      }
      if (!cancelled) setPeers(next)
    }

    void (async () => {
      try {
        const client = await getSupabaseClient()
        if (cancelled) return
        await removeStaleGameChannel(client, topic)
        if (cancelled) return
        const channel = client.channel(topic, { config: { presence: { key: presenceKey } } })
        channelRef.current = channel
        channel.on('presence', { event: 'sync' }, readPresence)
        channel.on('presence', { event: 'join' }, readPresence)
        channel.on('presence', { event: 'leave' }, readPresence)
        retrackRef.current = () => { void channel.track(meta()) }
        await channel.subscribe((status) => {
          if (cancelled) return
          if (status === 'SUBSCRIBED') retrackRef.current?.()
          else readPresence()
        })
      } catch { /* Offline: the board stays local. */ }
    })()

    return () => {
      cancelled = true
      retrackRef.current = null
      const channel = channelRef.current
      channelRef.current = null
      if (channel) void getSupabaseClient().then((client) => client.removeChannel(channel)).catch(() => {})
    }
  }, [instanceId, self.userId])

  // Publish score/identity/spin-count changes so peers see the new amount.
  useEffect(() => {
    retrackRef.current?.()
  }, [self.score, self.name, self.spins, self.avatarStyle, self.avatarSeed, self.avatarUrl])

  const players = useMemo<SlotLeaderboardPlayer[]>(() => {
    const present = presentUserIds.length === 0 ? null : new Set(presentUserIds)
    const map: Record<string, SlotLeaderboardPlayer> = {}
    for (const [uid, peer] of Object.entries(peers)) {
      if (peer.spins < 1) continue
      if (present && !present.has(uid)) continue
      map[uid] = { userId: uid, ...peer, isSelf: uid === self.userId }
    }
    if (self.userId && self.spins >= 1) {
      map[self.userId] = {
        userId: self.userId,
        name: self.name,
        score: self.score,
        spins: self.spins,
        avatarStyle: self.avatarStyle ?? map[self.userId]?.avatarStyle ?? '',
        avatarSeed: self.avatarSeed ?? map[self.userId]?.avatarSeed ?? self.userId,
        avatarUrl: self.avatarUrl ?? map[self.userId]?.avatarUrl ?? null,
        isSelf: true,
      }
    }
    return Object.values(map)
      .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId))
      // Render well past the visible ~5 rows so the box can scroll;
      // the cap is only a DOM-size guard.
      .slice(0, 50)
  }, [peers, presentUserIds, self.userId, self.name, self.score, self.spins, self.avatarStyle, self.avatarSeed, self.avatarUrl])

  const total = useMemo(() => {
    const present = presentUserIds.length === 0 ? null : new Set(presentUserIds)
    let count = 0
    let selfCounted = false
    for (const [uid, peer] of Object.entries(peers)) {
      if (peer.spins < 1) continue
      if (present && !present.has(uid)) continue
      count += 1
      if (uid === self.userId) selfCounted = true
    }
    // The self row is forced from local state, so count it unless a peer
    // entry for the same user already did.
    if (self.userId && self.spins >= 1 && !selfCounted) count += 1
    return count
  }, [peers, presentUserIds, self.userId, self.spins])

  const [flashes, setFlashes] = useState<Record<string, SlotBalanceFlash>>({})
  const prevScores = useRef<Record<string, number>>({})
  const flashSeq = useRef(0)
  useEffect(() => {
    const current: Record<string, number> = {}
    const next: Record<string, SlotBalanceFlash> = {}
    for (const player of players) {
      current[player.userId] = player.score
      const previous = prevScores.current[player.userId]
      if (previous !== undefined && previous !== player.score) {
        flashSeq.current += 1
        next[player.userId] = { id: flashSeq.current, delta: player.score - previous }
      }
    }
    prevScores.current = current
    if (Object.keys(next).length === 0) return
    // Defer to a callback so the flash lands outside the effect body.
    const timer = window.setTimeout(() => setFlashes((old) => ({ ...old, ...next })), 0)
    return () => window.clearTimeout(timer)
  }, [players])

  useEffect(() => {
    if (Object.keys(flashes).length === 0) return
    const timer = window.setTimeout(() => setFlashes({}), 1300)
    return () => window.clearTimeout(timer)
  }, [flashes])

  return { players, total, flashes }
}
