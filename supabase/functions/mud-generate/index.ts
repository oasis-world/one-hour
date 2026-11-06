import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const OPENCODE_MODEL = 'muse-spark-1.3-contributor'
const OPENCODE_ENDPOINT = 'https://opencode.ai/inference/go/openai/v1/responses'

function isRecord(v: unknown): v is Record<string, unknown> { return Boolean(v && typeof v === 'object' && !Array.isArray(v)) }
function parseJsonObject(text: string): Record<string, unknown> | null {
  try { const p: unknown = JSON.parse(text); return isRecord(p) ? p : null } catch { /* fallback below */ }
  const s = text.indexOf('{'), e = text.lastIndexOf('}')
  if (s < 0 || e <= s) return null
  try { const p: unknown = JSON.parse(text.slice(s, e + 1)); return isRecord(p) ? p : null } catch { return null }
}
function extractOpenCodeText(result: Record<string, unknown>): string {
  const output = result.output as Array<{ content?: Array<{ type?: string; text?: string }> }> | undefined
  if (!Array.isArray(output)) return ''
  return output
    .flatMap((it) => it.content ?? [])
    .filter((it) => it.type === 'output_text')
    .map((it) => it.text ?? '')
    .join('')
}
async function stableSessionId(seed: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed))
  return `ses_${Array.from(new Uint8Array(hash).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    if (!await isAuthenticated(req)) return json({ error: 'Authentication required' }, 401)
  } catch {
    return json({ error: 'Authentication check failed' }, 401)
  }
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
  const { blueprint, party, lang } = body as Record<string, unknown>
  if (!blueprint || !Array.isArray(party)) return json({ error: 'Invalid payload' }, 400)

  // If AI not configured, return a deterministic template so client never sees 502
  const apiKey = Deno.env.get('OPENCODE_API_KEY')
  if (!apiKey) {
    return json(fallbackScene(blueprint as Record<string, unknown>, party as unknown[], lang as string))
  }

  const partyDesc = (party as Array<{ displayName?: string; role?: string }>)
    .map((p) => `${p.displayName ?? '?'}(${p.role ?? 'adventurer'})`).join(', ')
  const bp = blueprint as { title?: string; titleEn?: string; theme?: string; rooms?: Array<{ name?: string; nameEn?: string }> }
  const roomsStr = (bp.rooms ?? []).map((r) => r.nameEn ?? r.name).join(' -> ') || 'mysterious dungeon'
  const sysPrompt = `You are a MUD game master for a chat room. Theme: ${bp.theme ?? 'ruin'}, Rooms: ${roomsStr}. Party: ${partyDesc}. Lang: ${lang ?? 'zh'}.
Write an opening scene (2-3 sentences, vivid, incorporate players' roles) and 2-4 choice labels.
Output ONLY valid JSON: {"sceneText": string (1-3 vivid sentences), "choices": [{"label": string (2-8 chars), "action": string (snake_case)}]}`

  try {
    const sessionId = await stableSessionId(JSON.stringify([bp.titleEn ?? bp.title ?? '', partyDesc])).catch(() => 'mud-generate')
    const upstream = await fetch(OPENCODE_ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'x-opencode-session': sessionId },
      body: JSON.stringify({
        model: OPENCODE_MODEL,
        instructions: sysPrompt,
        input: JSON.stringify({ blueprint, party }),
        max_output_tokens: 2048,
        reasoning: { effort: 'minimal' },
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!upstream.ok) {
      const t = await upstream.text().catch(() => '')
      console.warn('[mud-generate] upstream failed', upstream.status, t.slice(0, 300))
      return json(fallbackScene(blueprint as Record<string, unknown>, party as unknown[], lang as string))
    }
    const result = await upstream.json() as Record<string, unknown>
    if (result.status && result.status !== 'completed') {
      console.warn('[mud-generate] OpenCode incomplete', result.status)
      return json(fallbackScene(blueprint as Record<string, unknown>, party as unknown[], lang as string))
    }
    const text = extractOpenCodeText(result).trim()
    if (!text) {
      console.warn('[mud-generate] empty reply, fallback')
      return json(fallbackScene(blueprint as Record<string, unknown>, party as unknown[], lang as string))
    }
    const parsed = parseJsonObject(text)
    if (!parsed || typeof parsed.sceneText !== 'string' || !Array.isArray(parsed.choices)) {
      console.warn('[mud-generate] invalid AI JSON, fallback', text.slice(0, 200))
      return json(fallbackScene(blueprint as Record<string, unknown>, party as unknown[], lang as string))
    }
    return json({ sceneText: parsed.sceneText, choices: parsed.choices })
  } catch (e) {
    console.warn('[mud-generate] error, fallback', (e as Error).message)
    return json(fallbackScene(blueprint as Record<string, unknown>, party as unknown[], lang as string))
  }
})

function fallbackScene(bp: Record<string, unknown>, party: unknown[], lang: unknown): { sceneText: string; choices: Array<{ label: string; action: string }> } {
  const isZh = typeof lang === 'string' && (lang as string).startsWith('zh')
  const title = (bp.title as string) ?? (bp.titleEn as string) ?? (isZh ? '神秘遗迹' : 'Mysterious Ruin')
  const names = (party as Array<{ displayName?: string }>).map((p) => p.displayName ?? '?').join(isZh ? '、' : ', ')
  const firstRoom = ((bp.rooms as Array<{ name?: string; nameEn?: string }>)?.[0]?.name) ?? ((bp.rooms as Array<{ name?: string; nameEn?: string }>)?.[0]?.nameEn) ?? (isZh ? '大门前' : 'the gate')
  if (isZh) {
    return {
      sceneText: `欢迎来到《${title}》！冒险者 ${names} 聚集在${firstRoom}前，微光闪烁，前方传来神秘声响，旅程即将开始。`,
      choices: [{ label: '探索四周', action: 'explore' }, { label: '与之交谈', action: 'talk' }, { label: '小心潜行', action: 'sneak' }],
    }
  }
  return {
    sceneText: `Welcome to "${title}"! Adventurers ${names} gather at ${firstRoom}. A faint glow flickers ahead — your journey begins.`,
    choices: [{ label: 'Explore', action: 'explore' }, { label: 'Talk', action: 'talk' }, { label: 'Sneak', action: 'sneak' }],
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } })
}

async function isAuthenticated(request: Request): Promise<boolean> {
  const auth = request.headers.get('authorization')
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? defaultKey()
  if (!auth?.startsWith('Bearer ') || !url || !anon) return false
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const r = await fetch(`${url}/auth/v1/user`, { headers: { authorization: auth, apikey: anon }, signal: controller.signal })
    clearTimeout(timer)
    return r.ok
  } catch { return false }
}
function defaultKey(): string | undefined { try { const k = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}'); return k.default } catch { return undefined } }
