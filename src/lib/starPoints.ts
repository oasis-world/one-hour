import { getSupabaseClient } from './supabaseClient'
import { isSupabaseConfigured } from './supabaseConfig'

const KEY = 'one-hour-star-score'
const VERSION_KEY = 'one-hour-star-score-v2'
const listeners = new Set<(score: number) => void>()
let cached: number | null = null
let revision = 0
let pointWrites: Promise<void> = Promise.resolve()
const lastRewardAt = new Map<string, number>()

function store(score: number): number {
  revision += 1
  cached = Math.max(0, Math.floor(score))
  try {
    globalThis.localStorage?.setItem(KEY, String(cached))
    globalThis.localStorage?.setItem(VERSION_KEY, '1')
  } catch { /* local storage is optional */ }
  listeners.forEach((listener) => listener(cached!))
  return cached
}

export function readStarPoints(): number {
  if (cached !== null) return cached
  try {
    if (!globalThis.localStorage?.getItem(VERSION_KEY)) {
      const legacy = Number(globalThis.localStorage?.getItem(KEY) ?? 0)
      cached = Number.isFinite(legacy) && legacy > 0 ? Math.floor(legacy) : 100
      globalThis.localStorage?.setItem(VERSION_KEY, '1')
      globalThis.localStorage?.setItem(KEY, String(cached))
      return cached
    }
    const raw = globalThis.localStorage?.getItem(KEY)
    cached = raw == null ? 100 : Math.max(0, Math.floor(Number(raw) || 0))
  } catch { cached = 100 }
  return cached
}

export function setStarPoints(score: number): number { return store(score) }

export function adjustStarPoints(delta: number, animateChange = false): number {
  const next = Math.max(0, readStarPoints() + Math.trunc(delta))
  store(next)
  if (animateChange) window.dispatchEvent(new CustomEvent('one-hour:star-points-delta', { detail: { delta: Math.trunc(delta) } }))
  if (delta !== 0) void persistDelta(Math.trunc(delta))
  return next
}

export function subscribeStarPoints(listener: (score: number) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function claimStarReward(kind: 'message' | 'photo', userId = 'local'): boolean {
  const key = `one-hour-star-reward-${userId}-${kind}-at`
  const now = Date.now()
  let last = lastRewardAt.get(key) ?? 0
  try {
    last = Math.max(last, Number(globalThis.localStorage?.getItem(key) ?? 0))
  } catch { /* in-memory cooldown still applies in private browsing */ }
  if (now - last < 10_000) return false
  lastRewardAt.set(key, now)
  try { globalThis.localStorage?.setItem(key, String(now)) } catch { /* best effort */ }
  return true
}

export async function syncStarPoints(userId: string): Promise<() => void> {
  if (!isSupabaseConfigured()) return () => undefined
  const before = revision
  try {
    const client = await getSupabaseClient()
    const { data, error } = await client.rpc('ensure_star_points')
    if (!error && Number.isFinite(data) && revision === before) store(Number(data))
    const channel = client.channel(`star-points:${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'star_points', filter: `user_id=eq.${userId}` }, (payload) => {
        const balance = (payload.new as { balance?: unknown }).balance
        if (typeof balance === 'number') store(balance)
      })
      .subscribe()
    return () => { void client.removeChannel(channel) }
  } catch { /* The local balance remains usable without a backend. */ }
  return () => undefined
}

export async function transferStarPoints(transferId: string, recipientId: string, points: number): Promise<boolean> {
  if (!isSupabaseConfigured() || points <= 0) return false
  try {
    await pointWrites
    const client = await getSupabaseClient()
    const { error } = await client.rpc('transfer_star_points', {
      p_transfer_id: transferId,
      p_recipient: recipientId,
      p_amount: Math.floor(points),
    })
    return !error
  } catch { return false }
}

function persistDelta(delta: number): void {
  pointWrites = pointWrites.then(async () => {
    if (!isSupabaseConfigured()) return
    try {
      const client = await getSupabaseClient()
      await client.rpc('change_star_points', { p_delta: delta })
    } catch { /* Offline edits stay local and sync is best-effort. */ }
  })
}
