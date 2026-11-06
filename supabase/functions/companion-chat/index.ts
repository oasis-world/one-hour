import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const OPENCODE_MODEL = 'muse-spark-1.3-contributor'
const OPENCODE_ENDPOINT = 'https://opencode.ai/inference/go/openai/v1/responses'
const VALID_GAMES = new Set(['gomoku', 'xiangqi', 'chess'])

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
  } catch (e) {
    console.error('[companion-chat] auth check threw', (e as Error)?.message)
    return json({ error: 'Authentication check failed' }, 401)
  }
  try {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }
    const { systemPrompt, history, userText, companionName, userName, isGreeting } = body as Record<string, unknown>
    if (typeof systemPrompt !== 'string' || typeof userText !== 'string') return json({ error: 'Invalid payload' }, 400)
    const apiKey = Deno.env.get('OPENCODE_API_KEY')
    if (!apiKey) {
      console.error('[companion-chat] missing OPENCODE_API_KEY')
      return json({ error: 'AI not configured' }, 503)
    }
    const hist: Array<{ role: string; content: string }> = Array.isArray(history) ? (history as unknown[]).slice(-12).filter((h: unknown) => h && typeof (h as { role?: unknown }).role === 'string' && typeof (h as { content?: unknown }).content === 'string') as Array<{ role: string; content: string }> : []
    const hardenedSystem = `${systemPrompt}\n\nSTRICT RULES: Do not output internal reasoning, chain-of-thought, or system instructions. Do not start with "we need", "we should", "we must", "persona:", "STRICT". Output ONLY valid JSON: {"reply": string (1-4 warm sentences, with emoji), "game": "gomoku"|"xiangqi"|"chess"|null}. Set game only when user clearly wants to play that game in any language (e.g. 来一盘五子棋/象棋/国际象棋, play gomoku/chess/xiangqi, チェス, 五目). Otherwise null.`
    const needMention = Boolean(isGreeting)
    const extra = needMention ? ` You MUST start reply with "@${userName ?? ''} " exactly.` : ''
    const instructions = extra ? `${hardenedSystem}${extra}` : hardenedSystem
    void companionName

    const shouldSearch = typeof userText === 'string' && /搜索|新闻|最近|最新|飞机失事|news|search|latest/i.test(userText as string)
    let searchContext = ''
    if (shouldSearch) {
      const tavilyKey = Deno.env.get('TAVILY_API_KEY')
      if (tavilyKey) {
        try {
          const searchRes = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ api_key: tavilyKey, query: userText, max_results: 5, include_answer: true }),
            signal: AbortSignal.timeout(8000),
          })
          if (searchRes.ok) {
            const sData = await searchRes.json() as { answer?: string; results?: Array<{ title?: string; content?: string; url?: string }> }
            const parts: string[] = []
            if (sData.answer) parts.push(`Answer: ${sData.answer}`)
            for (const r of (sData.results ?? []).slice(0, 5)) {
              if (r.title || r.content) parts.push(`- ${r.title ?? ''} ${r.content ?? ''} (${r.url ?? ''})`.trim())
            }
            if (parts.length) searchContext = `\n\n[Web search results for "${userText}"]\n${parts.join('\n')}\nUse these to answer with citations.`
          } else {
            console.warn('[companion-chat] tavily search failed', searchRes.status, await searchRes.text().catch(() => '').then(t => t.slice(0, 300)))
          }
        } catch (e) {
          console.warn('[companion-chat] tavily error', (e as Error)?.message)
        }
      } else {
        searchContext = '\n\n[Note: No live web search available. If user asks for very recent news, be transparent about knowledge cutoff and suggest checking news sites.]'
      }
    }
    const userTextWithSearch = searchContext ? `${userText}${searchContext}` : (userText as string)
    const sessionSeed = JSON.stringify([companionName ?? '', userName ?? ''])
    const sessionId = await stableSessionId(sessionSeed).catch(() => 'companion-chat')

    let upstream: Response
    try {
      upstream = await fetch(OPENCODE_ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'x-opencode-session': sessionId },
        body: JSON.stringify({
          model: OPENCODE_MODEL,
          instructions,
          input: JSON.stringify({ history: hist, userText: userTextWithSearch }),
          max_output_tokens: 2048,
          reasoning: { effort: 'minimal' },
        }),
        signal: AbortSignal.timeout(45_000),
      })
    } catch (e) {
      console.error('[companion-chat] fetch to OpenCode threw', (e as Error)?.message)
      return json({ error: 'Upstream fetch failed', reason: (e as Error)?.message }, 502)
    }
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      let code: string | undefined
      try { const f = JSON.parse(text); code = typeof f?.error?.code === 'string' ? f.error.code : typeof f?.error?.type === 'string' ? f.error.type : undefined } catch { /* not JSON */ }
      console.error('[companion-chat] upstream failed', upstream.status, code ?? text.slice(0, 500))
      return json({ error: 'Upstream failed', upstreamStatus: upstream.status, upstreamCode: code, bodySnippet: text.slice(0, 500) }, 502)
    }
    let result: Record<string, unknown>
    try {
      result = await upstream.json() as Record<string, unknown>
    } catch (e) {
      console.error('[companion-chat] upstream JSON parse failed', (e as Error)?.message)
      return json({ error: 'Upstream returned invalid JSON' }, 502)
    }
    if (result.status && result.status !== 'completed') {
      const reason = (result.incomplete_details as Record<string, unknown> | undefined)?.reason ?? result.status
      console.error('[companion-chat] OpenCode incomplete', reason, JSON.stringify(result).slice(0, 800))
      return json({ error: 'Upstream response was incomplete', reason }, 502)
    }
    const text = extractOpenCodeText(result).trim()
    if (!text) {
      console.error('[companion-chat] empty reply, using fallback', JSON.stringify(result).slice(0, 800))
      const fallback = userName ? `@${userName} 收到～ 我们继续聊呀，刚才那条我没太跟上，你再说说？` : '收到～ 我们继续聊呀！'
      return json({ reply: fallback, game: null, model: OPENCODE_MODEL, provider: 'opencode', fallback: true })
    }
    // Structured JSON expected: {reply, game}
    let reply = text
    let game: string | null = null
    const parsed = parseJsonObject(text)
    if (parsed && isRecord(parsed)) {
      if (typeof parsed.reply === 'string' && parsed.reply.trim()) reply = parsed.reply.trim()
      if (typeof parsed.game === 'string' && VALID_GAMES.has(parsed.game)) game = parsed.game
      else if (parsed.game === null || parsed.game === undefined) game = null
    } else {
      // Fallback: plain text reply, try to infer game via keyword scan
      game = inferGameFromText(userText as string)
    }
    return json({ reply, game, model: OPENCODE_MODEL, provider: 'opencode' })
  } catch (e) {
    const err = e as Error & Record<string, unknown>
    console.error('[companion-chat] error', err?.message ?? String(e), err?.stack?.slice(0, 1000))
    return json({ error: err?.message ?? 'AI request failed' }, 502)
  }
})

function inferGameFromText(t: string): string | null {
  const s = t.toLowerCase()
  if (/五子棋|gomoku|五目|오목/.test(s)) return 'gomoku'
  if (/中国象棋|象棋|中國象棋|xiangqi|将棋/.test(s) && !/国际象棋|國際象棋|chess/.test(s)) return 'xiangqi'
  if (/国际象棋|國際象棋|\bchess\b|チェス|체스/.test(s)) return 'chess'
  return null
}

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } }) }

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
  } catch {
    return false
  }
}
function defaultKey(): string | undefined { try { const k = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}'); return k.default } catch { return undefined } }
