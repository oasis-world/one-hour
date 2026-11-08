import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const MODEL = 'muse-spark-1.3-contributor'
const ENDPOINT = 'https://opencode.ai/inference/go/openai/v1/responses'

function parseJsonObject(text: string): Record<string, unknown> | null {
  try { const p: unknown = JSON.parse(text); return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : null } catch { /* fallback */ }
  const s = text.indexOf('{'), e = text.lastIndexOf('}')
  if (s < 0 || e <= s) return null
  try { const p: unknown = JSON.parse(text.slice(s, e + 1)); return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : null } catch { return null }
}
function extractText(r: Record<string, unknown>): string {
  const out = r.output as Array<{ content?: Array<{ type?: string; text?: string }> }> | undefined
  if (!Array.isArray(out)) return ''
  return out.flatMap((it) => it.content ?? []).filter((c) => c.type === 'output_text').map((c) => c.text ?? '').join('')
}
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } }) }
async function auth(req: Request): Promise<boolean> {
  const a = req.headers.get('authorization'); const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  if (!a?.startsWith('Bearer ') || !url || !anon) return false
  try { const r = await fetch(`${url}/auth/v1/user`, { headers: { authorization: a, apikey: anon }, signal: AbortSignal.timeout(5000) }); return r.ok } catch { return false }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!await auth(req).catch(() => false)) return json({ error: 'Authentication required' }, 401)
  let body: Record<string, unknown>; try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
  const { prompt, roomId, regionId, lang } = body as { prompt?: string; roomId?: string; regionId?: string; lang?: string }
  if (typeof prompt !== 'string' || !prompt.trim()) return json({ error: 'Missing prompt' }, 400)
  const apiKey = Deno.env.get('OPENCODE_API_KEY')
  const uiLang = (lang ?? 'zh').slice(0, 10)
  const fallback = { title: prompt.slice(0, 24), desc: '潮汐之音在耳边低语，跟着指引走，答案藏在日常细节里。', rewardXp: 15, reward_item_id: null, _fallback: 'no-key' }
  if (!apiKey) return json(fallback)
  const sysPrompt = `You generate ONE side-quest for open-world MUD "Tide Genesis". Output ONLY JSON: {"title": string, "desc": string, "rewardXp": number 10-40, "reward_item_id": string|null}
Rules: title <=30 chars, desc <=160 chars, rewardXp integer 10-40, reward_item_id must be one of item-tide-blade/item-dawn-amulet/item-star-compass/item-tide-pouch/item-abyss-lantern/item-gold-key/item-moon-vial/item-tide-core or null. Quest is a gentle puzzle/exploration beat in room ${roomId ?? 'plaza_center'} region ${regionId ?? 'plaza'}. Response language: ${uiLang}. No extra text.`
  try {
    const upstream = await fetch(ENDPOINT, { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: MODEL, instructions: sysPrompt, input: JSON.stringify({ prompt: prompt.slice(0, 300) }), max_output_tokens: 1024, reasoning: { effort: 'minimal' } }), signal: AbortSignal.timeout(20000) })
    if (!upstream.ok) return json({ ...fallback, _fallback: `upstream-${upstream.status}` })
    const result = await upstream.json() as Record<string, unknown>
    const text = extractText(result).trim(); const parsed = text ? parseJsonObject(text) : null
    if (!parsed || typeof parsed.title !== 'string') return json({ ...fallback, _fallback: 'bad-json' })
    const valid = new Set(['item-tide-blade', 'item-dawn-amulet', 'item-star-compass', 'item-tide-pouch', 'item-abyss-lantern', 'item-gold-key', 'item-moon-vial', 'item-tide-core'])
    const rid = typeof parsed.reward_item_id === 'string' && valid.has(parsed.reward_item_id) ? parsed.reward_item_id : null
    return json({ title: String(parsed.title).slice(0, 60), desc: String(parsed.desc ?? '').slice(0, 300), rewardXp: typeof parsed.rewardXp === 'number' ? Math.min(40, Math.max(10, Math.round(parsed.rewardXp))) : 15, reward_item_id: rid })
  } catch { return json({ ...fallback, _fallback: 'exception' }) }
})
