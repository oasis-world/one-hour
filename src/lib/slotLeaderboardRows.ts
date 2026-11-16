import { getSupabaseClient } from './supabaseClient'
import { isSupabaseConfigured } from './supabaseConfig'

export interface SlotLeaderboardRow {
  instanceId: string
  playerKey: string
  userId: string
  name: string
  score: number
  spins: number
  avatarStyle: string
  avatarSeed: string
  avatarUrl: string | null
  /** Epoch ms of the row's last heartbeat, from the DB server clock. */
  updatedAt: number
}

const TABLE = 'slot_leaderboard'

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0
}

/** The DB timestamp is authoritative; fall back to now for clock-less rows. */
function readTime(value: unknown): number {
  if (typeof value !== 'string') return Date.now()
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : Date.now()
}

function parseRow(row: Record<string, unknown> | null): SlotLeaderboardRow | null {
  if (!row || typeof row.user_id !== 'string' || typeof row.player_key !== 'string') return null
  return {
    instanceId: String(row.instance_id ?? ''),
    playerKey: row.player_key,
    userId: row.user_id,
    name: typeof row.name === 'string' && row.name ? row.name : 'Player',
    score: num(row.score),
    spins: num(row.spins),
    avatarStyle: typeof row.avatar_style === 'string' ? row.avatar_style : '',
    avatarSeed: typeof row.avatar_seed === 'string' ? row.avatar_seed : '',
    avatarUrl: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    updatedAt: readTime(row.updated_at),
  }
}

export interface UpsertRow {
  instanceId: string
  playerKey: string
  userId: string
  name: string
  score: number
  spins: number
  avatarStyle: string | null
  avatarSeed: string | null
  avatarUrl: string | null
  /** Profile expiry (epoch ms); null → one hour from now. */
  expiresAt: number | null
}

/** Create or refresh this page's row. `updated_at` is refreshed server-side. */
export async function upsertSlotLeaderboardRow(row: UpsertRow): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  try {
    const client = await getSupabaseClient()
    const { error } = await client.from(TABLE).upsert({
      instance_id: row.instanceId,
      player_key: row.playerKey,
      user_id: row.userId,
      name: row.name,
      score: row.score,
      spins: row.spins,
      avatar_style: row.avatarStyle ?? '',
      avatar_seed: row.avatarSeed ?? '',
      avatar_url: row.avatarUrl,
      expires_at: new Date(row.expiresAt ?? Date.now() + 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'instance_id,player_key' })
    return !error
  } catch {
    return false
  }
}

export async function deleteSlotLeaderboardRow(instanceId: string, playerKey: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    const client = await getSupabaseClient()
    await client.from(TABLE).delete().eq('instance_id', instanceId).eq('player_key', playerKey)
  } catch { /* Offline: the row expires on its own. */ }
}

/** All live rows for one card. Returns null when the backend is unavailable. */
export async function readSlotLeaderboardRows(instanceId: string): Promise<SlotLeaderboardRow[] | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const client = await getSupabaseClient()
    const { data, error } = await client.from(TABLE)
      .select('instance_id,player_key,user_id,name,score,spins,avatar_style,avatar_seed,avatar_url,updated_at')
      .eq('instance_id', instanceId)
      .gt('expires_at', new Date().toISOString())
    if (error) return null
    return ((data ?? []) as Array<Record<string, unknown>>).flatMap((row) => {
      const parsed = parseRow(row)
      return parsed ? [parsed] : []
    })
  } catch {
    return null
  }
}

/** Re-fetch on any insert/update/delete for this card. */
export function subscribeSlotLeaderboardRows(instanceId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured()) return () => undefined
  let disposed = false
  let unsubscribe: (() => void) | undefined
  void (async () => {
    try {
      const client = await getSupabaseClient()
      if (disposed) return
      const channel = client.channel(`slot-leaderboard-rows:${instanceId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: TABLE, filter: `instance_id=eq.${instanceId}`,
        }, () => { if (!disposed) onChange() })
        .subscribe()
      unsubscribe = () => { void client.removeChannel(channel) }
    } catch { /* Offline: periodic read still refreshes the board. */ }
  })()
  return () => {
    disposed = true
    unsubscribe?.()
  }
}
