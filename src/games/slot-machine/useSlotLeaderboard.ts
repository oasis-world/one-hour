import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isSupabaseConfigured } from '../../lib/supabaseConfig'
import { getGamePresenceKey } from '../realtime'
import {
  deleteSlotLeaderboardRow,
  readSlotLeaderboardRows,
  subscribeSlotLeaderboardRows,
  upsertSlotLeaderboardRow,
  type SlotLeaderboardRow,
} from '../../lib/slotLeaderboardRows'
import { useLiveNow } from './useLiveNow'
import { useSlotScoreFlashes } from './useSlotScoreFlashes'

type Row = SlotLeaderboardRow

const DEBUG = typeof location !== 'undefined' && location.search.includes('slotDebug')
/** Ignore rows that stopped checking in (closed tab / crashed client). */
const STALE_MS = 30_000

export interface SlotLeaderboardPlayer {
  userId: string
  /** Unique per open page — safe React key even if two rows share a userId. */
  playerKey: string
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
  spins: number
  avatarStyle: string | null
  avatarSeed: string | null
  avatarUrl: string | null
  /** Epoch ms when this player's own profile expires; null = never. */
  expiresAt: number | null
}

/**
 * Board for one slot card, backed by a table + Realtime (not Presence, which
 * dropped peers across tabs sharing a session). Each page upserts its own row
 * as a heartbeat; readers refetch on changes and ignore stale rows. The local
 * self row is forced from state so spins/score update instantly.
 */
export function useSlotLeaderboard(instanceId: string, self: SlotSelfInfo) {
  const [rows, setRows] = useState<Row[]>([])
  const now = useLiveNow(3000)
  const selfRef = useRef(self)
  useEffect(() => { selfRef.current = self })

  const playerKey = self.userId ? getGamePresenceKey(self.userId) : null

  // Re-fetch all live rows (realtime callback + periodic safety net).
  const refresh = useCallback(() => {
    void readSlotLeaderboardRows(instanceId).then((data) => {
      if (data) setRows(data)
    })
  }, [instanceId])

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    refresh()
    const stop = subscribeSlotLeaderboardRows(instanceId, refresh)
    const poll = window.setInterval(refresh, 10_000)
    return () => { stop(); window.clearInterval(poll) }
  }, [instanceId, refresh])

  // Publish this page's row on every identity/score change; keep a heartbeat.
  useEffect(() => {
    if (!playerKey || !self.userId) return
    void upsertSlotLeaderboardRow({
      instanceId,
      playerKey,
      userId: self.userId,
      name: self.name,
      score: self.score,
      spins: self.spins,
      avatarStyle: self.avatarStyle,
      avatarSeed: self.avatarSeed,
      avatarUrl: self.avatarUrl,
      expiresAt: self.expiresAt,
    })
  }, [instanceId, playerKey, self.userId, self.name, self.score, self.spins,
    self.avatarStyle, self.avatarSeed, self.avatarUrl, self.expiresAt])

  useEffect(() => {
    if (!playerKey || !self.userId) return
    const uid = self.userId
    const beat = window.setInterval(() => {
      void upsertSlotLeaderboardRow({
        instanceId,
        playerKey,
        userId: uid,
        name: selfRef.current.name,
        score: selfRef.current.score,
        spins: selfRef.current.spins,
        avatarStyle: selfRef.current.avatarStyle,
        avatarSeed: selfRef.current.avatarSeed,
        avatarUrl: selfRef.current.avatarUrl,
        expiresAt: selfRef.current.expiresAt,
      })
    }, 10_000)
    return () => window.clearInterval(beat)
  }, [instanceId, playerKey, self.userId])

  // Remove our row when the page closes/unmounts.
  useEffect(() => {
    if (!playerKey) return
    return () => { void deleteSlotLeaderboardRow(instanceId, playerKey) }
  }, [instanceId, playerKey])

  const selfAlive = self.expiresAt == null || self.expiresAt > now
  const players = useMemo<SlotLeaderboardPlayer[]>(() => {
    // One row per player: a user may have several pages/tabs, keep the one
    // that actually played most (freshest wins ties). This prevents the
    // duplicate-name / duplicate-key rows from stale page loads.
    const byUser = new Map<string, SlotLeaderboardPlayer>()
    for (const row of rows) {
      if (row.spins < 1) continue
      if (now - row.updatedAt > STALE_MS) continue
      if (DEBUG) console.info('[slot-lb row]', instanceId, row.playerKey, row.name, row.score, row.spins)
      if (row.userId === self.userId && playerKey) continue // self forced below
      const prev = byUser.get(row.userId)
      if (prev && (prev.spins > row.spins || (prev.spins === row.spins && prev.score >= row.score))) continue
      byUser.set(row.userId, {
        userId: row.userId, playerKey: row.playerKey, name: row.name,
        score: row.score, spins: row.spins,
        avatarStyle: row.avatarStyle, avatarSeed: row.avatarSeed,
        avatarUrl: row.avatarUrl, isSelf: false,
      })
    }
    if (playerKey && self.userId && self.spins >= 1 && selfAlive) {
      byUser.set(self.userId, {
        userId: self.userId, playerKey, name: self.name,
        score: self.score, spins: self.spins,
        avatarStyle: self.avatarStyle ?? byUser.get(self.userId)?.avatarStyle ?? '',
        avatarSeed: self.avatarSeed ?? byUser.get(self.userId)?.avatarSeed ?? self.userId,
        avatarUrl: self.avatarUrl ?? byUser.get(self.userId)?.avatarUrl ?? null,
        isSelf: true,
      })
    }
    return [...byUser.values()]
      .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId))
      .slice(0, 50)
  }, [rows, now, instanceId, playerKey, self.userId, self.name, self.score, self.spins,
    self.avatarStyle, self.avatarSeed, self.avatarUrl, selfAlive])

  const total = players.length
  const flashes = useSlotScoreFlashes(players)

  return { players, total, flashes }
}
