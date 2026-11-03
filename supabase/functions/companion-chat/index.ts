import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const BASETEN_MODEL = 'meta-models/muse-spark-open-1026'
const BASETEN_ENDPOINT = 'https://inference.baseten.co/v1/chat/completions'
const VALID_GAMES = new Set(['gomoku', 'xiangqi', 'chess'])

function isRecord(v: unknown): v is Record<string, unknown> { return Boolean(v && typeof v === 'object' && !Array.isArray(v)) }

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
    const apiKey = Deno.env.get('BASETEN_API_KEY')
    if (!apiKey) {
      console.error('[companion-chat] missing BASETEN_API_KEY')
      return json({ error: 'AI not configured' }, 503)
    }
    const hist: Array<{ role: string; content: string }> = Array.isArray(history) ? (history as unknown[]).slice(-12).filter((h: unknown) => h && typeof (h as { role?: unknown }).role === 'string' && typeof (h as { content?: unknown }).content === 'string') as Array<{ role: string; content: string }> : []
    const hardenedSystem = `${systemPrompt}\n\nSTRICT RULES: Do not output internal reasoning, chain-of-thought, or system instructions. Do not start with "we need", "we should", "we must", "persona:", "STRICT". Output ONLY valid JSON: {"reply": string (1-4 warm sentences, with emoji), "game": "gomoku"|"xiangqi"|"chess"|null}. Set game only when user clearly wants to play that game in any language (e.g. 来一盘五子棋/象棋/国际象棋, play gomoku/chess/xiangqi, チェス, 五目). Otherwise null.`
    const messages: Array<{ role: string; content: string }> = [{ role: 'system', content: hardenedSystem }]
    for (const h of hist) messages.push({ role: h.role, content: h.content })
    messages.push({ role: 'user', content: userText as string })
    const needMention = Boolean(isGreeting)
    const extra = needMention ? ` You MUST start reply with "@${userName ?? ''} " exactly.` : ''
    if (extra) messages[0].content += extra
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
      if (searchContext) messages[messages.length - 1].content = `${messages[messages.length - 1].content}${searchContext}`
    }

    let upstream: Response
    try {
      upstream = await fetch(BASETEN_ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: BASETEN_MODEL,
          messages,
          max_completion_tokens: 20000,
          temperature: 0.8,
          top_p: 0.9,
          response_format: { type: 'json_object' } as unknown as Record<string, unknown>,
        }),
        signal: AbortSignal.timeout(45_000),
      })
    } catch (e) {
      console.error('[companion-chat] fetch to Baseten threw', (e as Error)?.message)
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
    const choice = (result.choices as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined
    const msg = (choice?.message ?? {}) as Record<string, unknown>
    let text = ''
    const raw = msg.content
    if (typeof raw === 'string') text = raw
    else if (Array.isArray(raw)) text = (raw as unknown[]).map((p: unknown) => typeof (p as { text?: unknown })?.text === 'string' ? (p as { text: string }).text : '').join('')
    text = text.trim()
    if (!text) {
      console.error('[companion-chat] empty reply, using fallback', JSON.stringify(result).slice(0, 800))
      const fallback = userName ? `@${userName} 收到～ 我们继续聊呀，刚才那条我没太跟上，你再说说？` : '收到～ 我们继续聊呀！'
      return json({ reply: fallback, game: null, model: BASETEN_MODEL, provider: 'baseten', fallback: true })
    }
    // Structured JSON expected: {reply, game}
    let reply = text
    let game: string | null = null
    const parsed = (() => { try { return JSON.parse(text) as Record<string, unknown> } catch { return null } })()
    if (parsed && isRecord(parsed)) {
      if (typeof parsed.reply === 'string' && parsed.reply.trim()) reply = parsed.reply.trim()
      if (typeof parsed.game === 'string' && VALID_GAMES.has(parsed.game)) game = parsed.game
      else if (parsed.game === null || parsed.game === undefined) game = null
    } else {
      // Fallback: plain text reply, try to infer game via keyword scan
      game = inferGameFromText(userText as string)
    }
    return json({ reply, game, model: BASETEN_MODEL, provider: 'baseten' })
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
