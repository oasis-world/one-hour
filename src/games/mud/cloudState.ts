import { getSupabaseClient } from '../../lib/supabaseClient'
import { isSupabaseConfigured } from '../../lib/supabaseConfig'
import type { MudState, MudPlayer } from './types'
import type { MudBlueprint, MudScene } from '../../lib/mudTemplates'

const STATE_TTL_MS = 60 * 60 * 1000
const LS_PREFIX = 'one-hour-mud:'

function lsKey(id: string): string { return `${LS_PREFIX}${id}` }

function saveLocal(id: string, state: MudState): void {
  try { globalThis.localStorage?.setItem(lsKey(id), JSON.stringify({ state, expiresAt: Date.now() + STATE_TTL_MS })) } catch { /* ignore */ }
}
function loadLocal(id: string): MudState | null {
  try {
    const raw = globalThis.localStorage?.getItem(lsKey(id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: MudState; expiresAt?: number }
    if (!parsed.state || typeof parsed.expiresAt !== 'number' || parsed.expiresAt <= Date.now()) return null
    return parsed.state
  } catch { return null }
}

export async function loadMudState(instanceId: string, signal?: AbortSignal): Promise<{ state: MudState | null; ok: boolean }> {
  if (!isSupabaseConfigured()) {
    const local = loadLocal(instanceId)
    return { state: local, ok: true }
  }
  try {
    const client = await getSupabaseClient()
    let q = client.from('mud_states').select('state').eq('instance_id', instanceId).gt('expires_at', new Date().toISOString())
    if (signal) q = q.abortSignal(signal)
    const { data, error } = await q.maybeSingle()
    if (error) {
      if (signal?.aborted) return { state: null, ok: false }
      // Table missing or RLS: fallback to local
      const local = loadLocal(instanceId)
      if (local) return { state: local, ok: true }
      console.warn('Could not load MUD state (fallback to local):', error.message)
      return { state: null, ok: true }
    }
    const s = data?.state as MudState | undefined
    if (s && s.instanceId === instanceId && s.blueprint) {
      saveLocal(instanceId, s)
      return { state: s, ok: true }
    }
    const local = loadLocal(instanceId)
    if (local) return { state: local, ok: true }
    return { state: null, ok: true }
  } catch {
    const local = loadLocal(instanceId)
    return { state: local, ok: true }
  }
}

export async function saveMudState(instanceId: string, state: MudState, shouldContinue: () => boolean = () => true): Promise<void> {
  if (!shouldContinue()) return
  saveLocal(instanceId, state)
  if (!isSupabaseConfigured()) return
  try {
    const client = await getSupabaseClient()
    const now = Date.now()
    const { error } = await client.from('mud_states').upsert({ instance_id: instanceId, state, updated_at: new Date(now).toISOString(), expires_at: new Date(now + STATE_TTL_MS).toISOString() }, { onConflict: 'instance_id' })
    if (error) console.warn('Could not save MUD state (local kept):', error.message)
  } catch { /* local kept */ }
}

export async function saveMudProgress(instanceId: string, state: MudState, shouldContinue: () => boolean = () => true): Promise<void> {
  if (!shouldContinue()) return
  saveLocal(instanceId, state)
  if (!isSupabaseConfigured()) return
  try {
    const client = await getSupabaseClient()
    const marker = `__GAME__:mud:${instanceId}`
    const { data: card, error: cardErr } = await client.from('chat_messages').select('id').like('content', `%${marker}%`).gt('expires_at', new Date().toISOString()).limit(1).maybeSingle()
    if (cardErr) { console.warn('Could not verify MUD card before save:', cardErr.message); return }
    if (!shouldContinue()) return
    if (!card) { if (shouldContinue()) await deleteMudState(instanceId); return }
    if (!shouldContinue()) return
    const now = Date.now()
    const { error } = await client.from('mud_states').upsert({ instance_id: instanceId, state, updated_at: new Date(now).toISOString(), expires_at: new Date(now + STATE_TTL_MS).toISOString() }, { onConflict: 'instance_id' })
    if (error) console.warn('Could not save MUD progress (local kept):', error.message)
  } catch { /* local kept */ }
}

export async function deleteMudState(instanceId: string): Promise<void> {
  try { globalThis.localStorage?.removeItem(lsKey(instanceId)) } catch { /* ignore */ }
  if (!isSupabaseConfigured()) return
  try {
    const client = await getSupabaseClient()
    const { error } = await client.from('mud_states').delete().eq('instance_id', instanceId)
    if (error) console.warn('Could not delete MUD state:', error.message)
  } catch { /* ignore */ }
}

export function createInitialMudState(
  instanceId: string,
  hostUserId: string,
  invited: MudPlayer[],
  blueprint: MudBlueprint,
  scene: MudScene,
  lang: string,
): MudState {
  return { instanceId, blueprint, hostUserId, invited, step: 0, history: [scene.text], scene, lang, createdAt: Date.now() }
}
