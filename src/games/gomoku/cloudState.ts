import { getSupabaseClient } from '../../lib/supabaseClient'
import { isGomokuState, type GomokuState } from './logic'

const STATE_TTL_MS = 60 * 60 * 1000

export async function loadGomokuState(instanceId: string): Promise<{ state: GomokuState | null; ok: boolean }> {
  const client = await getSupabaseClient()
  const { data, error } = await client
    .from('gomoku_states')
    .select('state')
    .eq('instance_id', instanceId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error) {
    console.error('Could not load Gomoku state:', error.message)
    return { state: null, ok: false }
  }
  return { state: isGomokuState(data?.state, instanceId) ? data.state : null, ok: true }
}

export async function saveGomokuState(instanceId: string, state: GomokuState): Promise<void> {
  const client = await getSupabaseClient()
  const marker = `__GAME__:gomoku:${instanceId}`
  const { data: card, error: cardError } = await client
    .from('chat_messages')
    .select('id')
    .like('content', `%${marker}%`)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle()
  if (cardError) {
    console.error('Could not verify Gomoku card before save:', cardError.message)
    return
  }
  if (!card) {
    await deleteGomokuState(instanceId)
    return
  }
  const now = Date.now()
  const { error } = await client.from('gomoku_states').upsert({
    instance_id: instanceId,
    state,
    updated_at: new Date(now).toISOString(),
    expires_at: new Date(now + STATE_TTL_MS).toISOString(),
  }, { onConflict: 'instance_id' })
  if (error) console.error('Could not save Gomoku state:', error.message)
}

export async function deleteGomokuState(instanceId: string): Promise<void> {
  const client = await getSupabaseClient()
  const { error } = await client.from('gomoku_states').delete().eq('instance_id', instanceId)
  if (error) console.error('Could not delete Gomoku state:', error.message)
}
