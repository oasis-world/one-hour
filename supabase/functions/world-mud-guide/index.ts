import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const MODEL = 'muse-spark-1.3-contributor'
const ENDPOINT = 'https://opencode.ai/inference/go/openai/v1/responses'

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

const FALLBACK: Record<string, string> = {
  zh: '潮汐启元世界已经在进行中：八域封印已松动，十二道主线封印等待破除。先从当前位置附近的谜题开始，解题得汐力升级境界，装备会随破封掉落。新人不是从零开始，而是直接加入当前进度一起贡献。',
  en: 'Tide Genesis is already underway: the eight regions are loosening and twelve mainline seals await. Start with puzzles near your room, earn Tide XP to raise your realm, and equipment drops as seals break. Newcomers do not start over — they join the current progress.',
  ja: '潮汐啓元はすでに始まっています。八域の封印が緩み、12の主となる封印が待っています。現在の部屋の近くのパズルから始めて、潮力を得て境界を上げ、装備は封印を解くことで得られます。新規参加者は最初からではなく、現在の進捗に参加します。',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!await auth(req).catch(() => false)) return json({ error: 'Authentication required' }, 401)
  let body: Record<string, unknown>; try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
  const { question, lang } = body as { question?: string; lang?: string }
  if (typeof question !== 'string' || !question.trim()) return json({ error: 'Missing question' }, 400)
  const uiLang = (lang ?? 'zh').slice(0, 10)
  const apiKey = Deno.env.get('OPENCODE_API_KEY')
  const fb = FALLBACK[uiLang] ?? FALLBACK.en!
  if (!apiKey) return json({ answer: fb, _fallback: 'no-key' })
  const sysPrompt = `You are the Tide Genesis Guide (守门人) in an open-world shared MUD. Answer ONLY in language ${uiLang}, 2-4 sentences, warm and concrete. Reference the shared world: 8 tide regions, 12 mainline seals, cultivation via Tide XP/realm level, equipment slots (weapon/amulet/compass/pouch). Newcomers join current progress. Do not reveal puzzle answers verbatim; give hints. Output ONLY JSON: {"answer": string}`
  try {
    const upstream = await fetch(ENDPOINT, { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: MODEL, instructions: sysPrompt, input: JSON.stringify({ question: question.slice(0, 300) }), max_output_tokens: 1024, reasoning: { effort: 'minimal' } }), signal: AbortSignal.timeout(20000) })
    if (!upstream.ok) return json({ answer: fb, _fallback: `upstream-${upstream.status}` })
    const result = await upstream.json() as Record<string, unknown>
    const text = extractText(result).trim()
    let answer = fb
    try { const p = JSON.parse(text.includes('{') ? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1) : text); if (typeof p.answer === 'string' && p.answer.trim()) answer = String(p.answer).slice(0, 800) } catch { if (text) answer = text.slice(0, 800) }
    return json({ answer })
  } catch { return json({ answer: fb, _fallback: 'exception' }) }
})
