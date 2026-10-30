import { getSupabaseClient } from '../../lib/supabaseClient'
import { isXiangqiState, type XiangqiState } from './logic'

const STATE_TTL_MS = 60 * 60 * 1000

export async function loadXiangqiState(instanceId: string): Promise<{ state: XiangqiState | null; ok: boolean }> {
  const client = await getSupabaseClient()
  const { data, error } = await client
    .from('xiangqi_states')
    .select('state')
    .eq('instance_id', instanceId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error) {
    console.error('Could not load Xiangqi state:', error.message)
    return { state: null, ok: false }
  }
  return { state: isXiangqiState(data?.state, instanceId) ? data.state : null, ok: true }
}

export async function saveXiangqiState(instanceId: string, state: XiangqiState): Promise<void> {
  const client = await getSupabaseClient()
  const marker = `__GAME__:xiangqi:${instanceId}`
  const { data: card, error: cardError } = await client
    .from('chat_messages')
    .select('id')
    .like('content', `%${marker}%`)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle()
  if (cardError) {
    console.error('Could not verify Xiangqi card before save:', cardError.message)
    return
  }
  if (!card) {
    await deleteXiangqiState(instanceId)
    return
  }
  const now = Date.now()
  const { error } = await client.from('xiangqi_states').upsert({
    instance_id: instanceId,
    state,
    updated_at: new Date(now).toISOString(),
    expires_at: new Date(now + STATE_TTL_MS).toISOString(),
  }, { onConflict: 'instance_id' })
  if (error) console.error('Could not save Xiangqi state:', error.message)
}

export async function deleteXiangqiState(instanceId: string): Promise<void> {
  const client = await getSupabaseClient()
  const { error } = await client.from('xiangqi_states').delete().eq('instance_id', instanceId)
  if (error) console.error('Could not delete Xiangqi state:', error.message)
}