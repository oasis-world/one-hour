import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const MODEL = 'muse-spark-1.3-contributor'
const ENDPOINT = 'https://opencode.ai/inference/go/openai/v1/responses'

function parseJsonObject(text: string): Record<string, unknown> | null {
  try { const p: unknown = JSON.parse(text); return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : null } catch { /* fallback below */ }
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

const LANG_NAME: Record<string, string> = {
  'zh': 'Simplified Chinese', 'zh-TW': 'Traditional Chinese', 'en': 'English', 'ja': 'Japanese',
  'fr': 'French', 'es': 'Spanish', 'de': 'German', 'ko': 'Korean', 'it': 'Italian', 'ar': 'Arabic',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!await auth(req).catch(() => false)) return json({ error: 'Authentication required' }, 401)
  let body: Record<string, unknown>; try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
  const { texts, targetLang } = body as { texts?: unknown; targetLang?: string }
  if (!Array.isArray(texts) || texts.length === 0) return json({ error: 'Missing texts' }, 400)
  const items = (texts as unknown[]).slice(0, 20).map((t) => {
    const r = t as Record<string, unknown>
    return { id: String(r.id ?? ''), text: String(r.text ?? '').slice(0, 600), from: String(r.from ?? 'auto').slice(0, 10) }
  }).filter((t) => t.id && t.text.trim())
  if (items.length === 0) return json({ error: 'Empty texts' }, 400)
  const target = (targetLang ?? 'en').slice(0, 10)
  const targetName = LANG_NAME[target] ?? target
  const apiKey = Deno.env.get('OPENCODE_API_KEY')
  const fallbackMap: Record<string, string> = {}
  for (const it of items) fallbackMap[it.id] = it.text
  if (!apiKey) return json({ translations: fallbackMap, _fallback: 'no-key' })
  const sysPrompt = `You translate short game strings into ${targetName} (${target}). Translate each item preserving meaning, game tone, and length. Output ONLY JSON: {"translations": {"id1": "translated", "id2": "translated", ...}} All values must be in ${targetName}. No extra text, never truncate URLs or names.`
  const input = JSON.stringify({ targetName, target, items: items.map((i) => ({ id: i.id, from: i.from, text: i.text })) })
  try {
    const upstream = await fetch(ENDPOINT, { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: MODEL, instructions: sysPrompt, input, max_output_tokens: 4096, reasoning: { effort: 'minimal' } }), signal: AbortSignal.timeout(25000) })
    if (!upstream.ok) return json({ translations: fallbackMap, _fallback: `upstream-${upstream.status}` })
    const result = await upstream.json() as Record<string, unknown>
    const text = extractText(result).trim()
    const parsed = text ? parseJsonObject(text) : null
    const raw = (parsed?.translations ?? null) as Record<string, unknown> | null
    if (!raw || typeof raw !== 'object') return json({ translations: fallbackMap, _fallback: 'bad-json' })
    const out: Record<string, string> = {}
    for (const it of items) out[it.id] = typeof raw[it.id] === 'string' && String(raw[it.id]).trim() ? String(raw[it.id]).slice(0, 600) : it.text
    return json({ translations: out })
  } catch { return json({ translations: fallbackMap, _fallback: 'exception' }) }
})
