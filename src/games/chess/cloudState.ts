import { getSupabaseClient } from '../../lib/supabaseClient'
import { isChessState, type ChessState } from './logic'

const TTL = 60 * 60 * 1000
export async function loadChessState(id:string, signal?:AbortSignal) {
  const client=await getSupabaseClient(); let q=client.from('chess_states').select('state').eq('instance_id',id).gt('expires_at',new Date().toISOString())
  if(signal)q=q.abortSignal(signal)
  const {data,error}=await q.maybeSingle(); if(error){if(!signal?.aborted)console.error('Could not load Chess state:',error.message);return {state:null,ok:false}}
  return {state:isChessState(data?.state,id)?data.state:null,ok:true}
}
export async function saveChessState(id:string,state:ChessState,shouldContinue:()=>boolean=()=>true) {
  if(!shouldContinue())return
  const client=await getSupabaseClient()
  if(!shouldContinue())return
  const marker=`__GAME__:chess:${id}`
  const {data:card,error:cardError}=await client.from('chat_messages').select('id').like('content',`%${marker}%`).gt('expires_at',new Date().toISOString()).limit(1).maybeSingle()
  if(cardError){console.error('Could not verify Chess card before save:',cardError.message);return}
  if(!shouldContinue())return
  if(!card){if(shouldContinue())await deleteChessState(id);return}
  const now=Date.now()
  if(!shouldContinue())return
  const {error}=await client.from('chess_states').upsert({instance_id:id,state,updated_at:new Date(now).toISOString(),expires_at:new Date(now+TTL).toISOString()},{onConflict:'instance_id'})
  if(error)console.error('Could not save Chess state:',error.message)
}
export async function deleteChessState(id:string) {
  const client=await getSupabaseClient(); const {error}=await client.from('chess_states').delete().eq('instance_id',id)
  if(error)console.error('Could not delete Chess state:',error.message)
}
