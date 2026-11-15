import { getSupabaseClient } from '../../lib/supabaseClient'
import type { BlackjackState } from './model'
import { isBlackjackState } from './validation'

const TTL = 60 * 60 * 1000

export async function loadBlackjackState(instanceId: string) {
  const client = await getSupabaseClient()
  const { data, error } = await client.from('blackjack_states').select('state')
    .eq('instance_id', instanceId).gt('expires_at', new Date().toISOString()).maybeSingle()
  if (error) {
    console.error('Could not load Blackjack state:', error.message)
    return null
  }
  return isBlackjackState(data?.state, instanceId) ? data.state : null
}

export async function saveBlackjackState(state: BlackjackState, shouldContinue: () => boolean) {
  if (!shouldContinue()) return
  const client = await getSupabaseClient()
  if (!shouldContinue()) return
  const marker = `__GAME__:blackjack:${state.instanceId}`
  const { data: card, error: cardError } = await client.from('chat_messages').select('id')
    .like('content', `%${marker}%`).gt('expires_at', new Date().toISOString()).limit(1).maybeSingle()
  if (cardError) {
    console.error('Could not verify Blackjack card before save:', cardError.message)
    return
  }
  if (!shouldContinue()) return
  if (!card) {
    await deleteBlackjackState(state.instanceId)
    return
  }
  const now = Date.now()
  const { error } = await client.from('blackjack_states').upsert({
    instance_id: state.instanceId, state, updated_at: new Date(now).toISOString(),
    expires_at: new Date(now + TTL).toISOString(),
  }, { onConflict: 'instance_id' })
  if (error) console.error('Could not save Blackjack state:', error.message)
}

export async function deleteBlackjackState(instanceId: string) {
  const client = await getSupabaseClient()
  const { error } = await client.from('blackjack_states').delete().eq('instance_id', instanceId)
  if (error) console.error('Could not delete Blackjack state:', error.message)
}
