import { getSupabaseClient } from './supabaseClient'
import { isSupabaseConfigured } from './supabaseConfig'
import type { MudBlueprint, MudScene } from './mudTemplates'
import type { PresenceMember } from './chatTypes'

export interface MudAiPayload {
  sceneText: string
  choices: Array<{ label: string; action: string }>
}

export async function requestMudScene(
  blueprint: MudBlueprint,
  party: PresenceMember[],
  lang: string,
): Promise<MudAiPayload | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const client = await getSupabaseClient()
    const { data, error } = await client.functions.invoke('mud-generate', {
      body: { blueprint, party: party.map((p) => ({ displayName: p.displayName, role: p.role ?? '' })), lang },
    })
    if (error) {
      // 502 / not deployed / missing key -> silently fall back to template, don't spam console
      if (typeof error.message === 'string' && /502|503|not configured|not found/i.test(error.message)) return null
      return null
    }
    if (!data) return null
    const text = typeof data.sceneText === 'string' ? data.sceneText.trim() : ''
    const choices = Array.isArray(data.choices) ? data.choices : []
    if (!text || choices.length < 2) return null
    const clean = choices
      .filter((c: unknown) => c && typeof (c as { label?: unknown }).label === 'string' && typeof (c as { action?: unknown }).action === 'string')
      .slice(0, 4)
      .map((c: { label: string; action: string }) => ({ label: c.label.slice(0, 24), action: c.action.slice(0, 24) }))
    if (clean.length < 2) return null
    return { sceneText: text.slice(0, 600), choices: clean }
  } catch {
    return null
  }
}

export function aiPayloadToScene(payload: MudAiPayload): MudScene {
  return { text: payload.sceneText, choices: payload.choices }
}
