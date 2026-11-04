/**
 * World MUD cloud state — persistent, never purged.
 * Single row `worldId='main'` holds the eternal realm.
 * Falls back to localStorage when Supabase not configured.
 */
import { getSupabaseClient } from '../../lib/supabaseClient'
import { isSupabaseConfigured } from '../../lib/supabaseConfig'
import { buildInitialWorldState, WORLD_ID, type WorldMudState } from './worldTypes'

const LS_KEY = 'one-hour-world-mud'
const WORLD_TTL_FALLBACK_MS = 365 * 24 * 60 * 60 * 1000

function saveLocal(state: WorldMudState): void {
  try {
    globalThis.localStorage?.setItem(LS_KEY, JSON.stringify({ state, expiresAt: Date.now() + WORLD_TTL_FALLBACK_MS }))
  } catch { /* ignore */ }
}
function loadLocal(): WorldMudState | null {
  try {
    const raw = globalThis.localStorage?.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: WorldMudState; expiresAt?: number }
    if (!parsed.state || typeof parsed.expiresAt !== 'number' || parsed.expiresAt <= Date.now()) return null
    return parsed.state as WorldMudState
  } catch { return null }
}

export async function loadWorldState(signal?: AbortSignal): Promise<WorldMudState> {
  if (!isSupabaseConfigured()) {
    return loadLocal() ?? buildInitialWorldState()
  }
  try {
    const client = await getSupabaseClient()
    let q = client.from('world_mud_state').select('state').eq('world_id', WORLD_ID).maybeSingle()
    if (signal) q = (q as unknown as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
    const { data, error } = await q
    if (error) {
      if (signal?.aborted) return loadLocal() ?? buildInitialWorldState()
      const local = loadLocal()
      if (local) return local
      console.warn('[world] load failed, using seed:', error.message)
      return buildInitialWorldState()
    }
    const s = data?.state as WorldMudState | undefined
    if (s && s.worldId === WORLD_ID && s.districts?.length) {
      const pruned = removeExpiredPlayers(s)
      if (pruned !== s) void saveWorldState(pruned)
      saveLocal(pruned)
      return pruned
    }
    const local = loadLocal()
    if (local) return local
    // First time: seed cloud
    const seeded = buildInitialWorldState()
    await saveWorldState(seeded)
    return seeded
  } catch {
    return loadLocal() ?? buildInitialWorldState()
  }
}

export async function saveWorldState(state: WorldMudState): Promise<void> {
  const stamped: WorldMudState = { ...state, updatedAt: Date.now() }
  saveLocal(stamped)
  if (!isSupabaseConfigured()) return
  try {
    const client = await getSupabaseClient()
    const { error } = await client.from('world_mud_state').upsert(
      { world_id: WORLD_ID, state: stamped as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: 'world_id' },
    )
    if (error) console.warn('[world] save failed (local kept):', error.message)
  } catch { /* local kept */ }
}

// Subscribe to realtime world changes (other players' actions)
export async function subscribeWorldState(onChange: (state: WorldMudState) => void): Promise<() => void> {
  if (!isSupabaseConfigured()) return () => {}
  try {
    const client = await getSupabaseClient()
    const channel = client
      .channel('world-mud')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'world_mud_state', filter: `world_id=eq.${WORLD_ID}` }, (payload: { new?: { state?: unknown } }) => {
        const s = (payload.new as { state?: WorldMudState } | undefined)?.state
        if (s && typeof s.worldId === 'string') onChange(s as WorldMudState)
      })
      .subscribe()
    return () => { void client.removeChannel(channel) }
  } catch {
    return () => {}
  }
}

export async function appendWorldLog(state: WorldMudState, entry: WorldMudState['log'][number]): Promise<WorldMudState> {
  const next: WorldMudState = {
    ...state,
    log: [...state.log, entry].slice(-80),
    stats: { ...state.stats, totalActions: state.stats.totalActions + 1 },
    updatedAt: Date.now(),
  }
  await saveWorldState(next)
  return next
}

// Player joins: upsert into players list
export function upsertWorldPlayer(state: WorldMudState, player: WorldMudState['players'][number]): WorldMudState {
  const exists = state.players.some((p) => p.userId === player.userId)
  const players = exists
    ? state.players.map((p) => (p.userId === player.userId ? player : p))
    : [...state.players, player]
  const stats = exists ? state.stats : { ...state.stats, totalPlayersEver: state.stats.totalPlayersEver + 1 }
  return { ...state, players, stats, updatedAt: Date.now() }
}

export function removeExpiredPlayers(state: WorldMudState, now = Date.now()): WorldMudState {
  // Player incarnation lasts 1 hour (profile expiresAt)
  const active = state.players.filter((p) => p.joinedAt + 60 * 60 * 1000 > now)
  if (active.length === state.players.length) return state
  return { ...state, players: active, updatedAt: now }
}
