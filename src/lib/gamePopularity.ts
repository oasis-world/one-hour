import { getSupabaseClient } from './supabaseClient'

export type GamePopularity = Record<string, number>

export async function loadGamePopularity(): Promise<GamePopularity> {
  const client = await getSupabaseClient()
  const { data, error } = await client
    .from('game_popularity')
    .select('game_id, click_count')
  if (error) throw error
  return Object.fromEntries((data ?? []).map((row) => [row.game_id, Number(row.click_count)]))
}

export async function recordGameSelection(gameId: string): Promise<void> {
  const client = await getSupabaseClient()
  const { error } = await client.rpc('record_game_selection', { p_game_id: gameId })
  if (error) throw error
}

export async function watchGamePopularity(onChange: () => void): Promise<() => void> {
  const client = await getSupabaseClient()
  const channel = client
    .channel('game-popularity')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'game_popularity',
    }, onChange)
    .subscribe()
  return () => { void client.removeChannel(channel) }
}
