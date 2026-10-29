import { getSupabaseClient } from '../../lib/supabaseClient'
import { isGomokuState, type GomokuState } from './logic'

const STATE_TTL_MS = 60 * 60 * 1000

export async function loadGomokuState(instanceId: string): Promise<GomokuState | null> {
  const client = await getSupabaseClient()
  const { data, error } = await client
    .from('gomoku_states')
    .select('state')
    .eq('instance_id', instanceId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error) {
    console.error('Could not load Gomoku state:', error.message)
    return null
  }
  return isGomokuState(data?.state, instanceId) ? data.state : null
}

export async function saveGomokuState(instanceId: string, state: GomokuState): Promise<void> {
  const client = await getSupabaseClient()
  const now = Date.now()
  const { error } = await client.from('gomoku_states').upsert({
    instance_id: instanceId,
    state,
    updated_at: new Date(now).toISOString(),
    expires_at: new Date(now + STATE_TTL_MS).toISOString(),
  }, { onConflict: 'instance_id' })
  if (error) console.error('Could not save Gomoku state:', error.message)
}
