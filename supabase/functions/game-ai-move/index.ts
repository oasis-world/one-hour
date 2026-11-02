import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// ── Provider abstraction (single-file to avoid Supabase bundler issues) ──
// To add a new provider: add entry to `providers` map below, implement its `request`.

type CloudGame = 'gomoku' | 'xiangqi' | 'chess'
type ProviderRequest = { game: CloudGame; sessionKey: string; sessionId: string; position: unknown; legalMoves: unknown[] }
type ProviderResult = { provider: string; model: string; move: unknown; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }
type AiProvider = { id: string; model: string; isConfigured(): boolean; request(req: ProviderRequest): Promise<ProviderResult> }

// ── Helpers shared by providers ──

function isRecord(v: unknown): v is Record<string, unknown> { return Boolean(v && typeof v === 'object' && !Array.isArray(v)) }
function parseJsonObject(text: string): Record<string, unknown> | null {
  try { const p: unknown = JSON.parse(text); return isRecord(p) ? p : null } catch { /* fallback below */ }
  const s = text.indexOf('{'), e = text.lastIndexOf('}')
  if (s < 0 || e <= s) return null
  try { const p: unknown = JSON.parse(text.slice(s, e + 1)); return isRecord(p) ? p : null } catch { return null }
}
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, val]) => `${JSON.stringify(k)}:${canonical(val)}`).join(',')}}`
  return JSON.stringify(v)
}
function sameMove(candidate: unknown, proposed: unknown, game: string): boolean {
  if (game === 'gomoku') return canonical(candidate) === canonical(proposed)
  if (!isRecord(candidate) || !isRecord(proposed)) return false
  return canonical((candidate as Record<string, unknown>).from) === canonical((proposed as Record<string, unknown>).from)
    && canonical((candidate as Record<string, unknown>).to) === canonical((proposed as Record<string, unknown>).to)
}
function throwUpstream(msg: string, status: number, upstreamStatus?: number, upstreamCode?: string, extra?: Record<string, unknown>): never {
  const e = new Error(msg) as Error & Record<string, unknown>
  e.status = status; e.upstreamStatus = upstreamStatus; e.upstreamCode = upstreamCode
  if (extra) Object.assign(e, extra); throw e
}

// ── Baseten provider (default) ──

const BASETEN_MODEL = 'meta-models/muse-spark-open-1026'
const BASETEN_ENDPOINT = 'https://inference.baseten.co/v1/chat/completions'
const GAME_RULES: Record<string, string> = {
  gomoku: "Gomoku 11x11, stones 1=black 2=white. Black moves first each round. Five in a row (horizontal/vertical/diagonal) wins. Board is Stone[row][col], 0 empty. Prioritize attack (create open-four/live-three) over passive defense; block opponent open-four immediately.",
  xiangqi: "Xiangqi 10x9, board[row][col] 10 rows, red=+ bottom, black=- top. Pieces: 1 General,2 Advisor,3 Elephant,4 Horse,5 Chariot,6 Cannon,7 Soldier. General in 3x3 palace, advisors/elephants cannot cross river, soldiers gain sideways after crossing. Flying general & check rules apply. Red first. Checkmate wins.",
  chess: "Chess 8x8, pieces w/b + kqrbnp. Turn w/b. Castling KQkq, enPassant square, halfmove for 50-move. PositionHistory detects repetition. Evaluate material, king safety, center control. Checkmate wins; stalemate/50-move/repetition/insufficient material draws.",
}

const basetenProvider: AiProvider = {
  id: 'baseten', model: BASETEN_MODEL,
  isConfigured() { return Boolean(Deno.env.get('BASETEN_API_KEY')) },
  async request(req) {
    const apiKey = Deno.env.get('BASETEN_API_KEY')
    if (!apiKey) throwUpstream('AI service is not configured', 503)
    const rules = GAME_RULES[req.game] ?? ""
    const pos = req.position as Record<string, unknown>
    const history = Array.isArray(pos.history) ? pos.history.slice(-12) : []
    const historyHint = history.length ? `\nRecentMoves (oldest→newest, last 12): ${JSON.stringify(history)}` : ""
    const threatSummary = typeof pos.threatSummary === 'string' ? pos.threatSummary : ""
    const threatHint = threatSummary ? `\nThreatSummary: ${threatSummary.slice(0, 800)}` : ""
    const annotated = Array.isArray(pos.annotatedMoves) ? pos.annotatedMoves : []
    const hintsHint = annotated.length ? `\nAnnotatedMoves (sorted by local engine, use as advisor not absolute): ${JSON.stringify(annotated).slice(0, 4000)}` : ""
    if (annotated.length) console.info(`[game-ai] hints=${annotated.length} threatLen=${threatSummary.length} game=${req.game}`)
    const upstream = await fetch(BASETEN_ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: BASETEN_MODEL,
        messages: [
          { role: 'system', content: `You are an expert ${req.game} strategist. Rules: ${rules} Think concisely in mind (2-4 sentences max) evaluating AnnotatedMoves hints (local engine scores) and ThreatSummary, then output ONLY valid JSON: {"move": <one element copied exactly from legalMoves>}. Prefer tactical wins (mate/check/block) over material when annotated. No markdown, no extra text. Copy verbatim, do not invent coordinates.` },
          { role: 'user', content: `Game:${req.game}\nPosition:${JSON.stringify(req.position)}${historyHint}${threatHint}${hintsHint}\nLegalMoves:${JSON.stringify(req.legalMoves)}\nChoose the strongest legal move and return {"move": <that move>} as JSON only.` },
        ],
        max_completion_tokens: 10000, temperature: 0.2,
        response_format: { type: "json_object" } as unknown as Record<string, unknown>,
      }),
      signal: AbortSignal.timeout(40_000),
    })
    if (!upstream.ok) {
      const f = await upstream.json().catch(() => null)
      const code = typeof f?.error?.code === 'string' ? f.error.code : typeof f?.error?.type === 'string' ? f.error.type : undefined
      console.error('[game-ai] Baseten upstream request failed', upstream.status, code ?? 'unknown')
      throwUpstream('Baseten upstream request failed', 502, upstream.status, code)
    }
    const result = await upstream.json()
    const choice = result.choices?.[0]
    const finish = choice?.finish_reason as string | undefined
    if (finish && finish !== 'stop' && finish !== 'length') { console.error('[game-ai] Baseten response was incomplete', finish, JSON.stringify(result).slice(0, 2000)); throwUpstream('Baseten response was incomplete', 502, undefined, undefined, { reason: finish }) }
    // Reasoning models may put output in reasoning_content or use array content
    const msg = choice?.message ?? {}
    let text: string = ''
    const rawContent: unknown = msg.content
    if (typeof rawContent === 'string') text = rawContent
    else if (Array.isArray(rawContent)) text = rawContent.map((p: unknown) => typeof (p as { text?: unknown })?.text === 'string' ? (p as { text: string }).text : typeof (p as { content?: unknown })?.content === 'string' ? (p as { content: string }).content : '').join('')
    // Fallback: some gateways use reasoning_content for thinking models
    if (!text && typeof msg.reasoning_content === 'string') text = msg.reasoning_content
    if (!text && typeof choice?.text === 'string') text = choice.text
    if (!text) {
      const raw = JSON.stringify(result).slice(0, 3000)
      console.error('[game-ai] Baseten response had no output text', { finish: finish ?? 'unknown', hasChoices: Array.isArray(result.choices), choicesLen: result.choices?.length ?? 0, msgKeys: msg ? Object.keys(msg) : [], usage: result.usage, raw })
      throwUpstream('Baseten response had no output text', 502, undefined, undefined, { reason: finish ?? 'unknown', rawSnippet: raw.slice(0, 800) })
    }
    let proposed: unknown = null
    const parsed = parseJsonObject(text)
    if (parsed) proposed = (parsed as Record<string, unknown>).move ?? parsed
    else {
      // Fallback: model leaked reasoning without JSON — try to mine a legal move from text
      console.warn('[game-ai] Baseten response was not JSON, attempting fallback extraction', text.slice(0, 2000))
      for (const candidate of req.legalMoves) {
        const candStr = JSON.stringify(candidate)
        // gomoku: {r,c} — look for "r" and "c" numbers; xiangqi/chess: from/to
        if (text.includes(candStr)) { proposed = candidate; break }
      }
      if (!proposed) {
        // Try to extract coordinate pairs like [3, 4] and match loosely
        const nums = Array.from(text.matchAll(/\[\s*(\d+)\s*,\s*(\d+)\s*\]/g)).map(m => [Number(m[1]), Number(m[2])])
        if (nums.length >= 2) {
          // Try to find a candidate whose from/to appears in extracted coords
          outer: for (const candidate of req.legalMoves) {
            if (!isRecord(candidate)) continue
            const from = (candidate as Record<string, unknown>).from as unknown
            const to = (candidate as Record<string, unknown>).to as unknown
            const hasFrom = Array.isArray(from) && nums.some(n => n[0] === (from as number[])[0] && n[1] === (from as number[])[1])
            const hasTo = Array.isArray(to) && nums.some(n => n[0] === (to as number[])[0] && n[1] === (to as number[])[1])
            if (hasFrom && hasTo) { proposed = candidate; break outer }
            // gomoku single coord
            if ('r' in (candidate as Record<string, unknown>)) {
              const r = (candidate as Record<string, unknown>).r; const c = (candidate as Record<string, unknown>).c
              if (nums.some(n => n[0] === r && n[1] === c)) { proposed = candidate; break }
            }
          }
        }
      }
      if (!proposed) { console.error('[game-ai] Baseten response was not valid JSON', text.length, text.slice(0, 1000)); throwUpstream('Baseten response was not valid JSON', 502, undefined, undefined, { rawSnippet: text.slice(0, 800) }) }
    }
    const move = req.legalMoves.find((c) => sameMove(c, proposed, req.game))
    if (!move) { console.error('[game-ai] Baseten response did not match a legal candidate', JSON.stringify(proposed).slice(0, 500)); throwUpstream('Model did not return a legal candidate', 502) }
    const usageBaseten = result.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined
    if (usageBaseten) console.info(`[game-ai] baseten usage prompt=${usageBaseten.prompt_tokens ?? "?"} completion=${usageBaseten.completion_tokens ?? "?"} total=${usageBaseten.total_tokens ?? "?"}`)
    return { provider: 'baseten', model: BASETEN_MODEL, move, usage: usageBaseten }
  },
}

// ── OpenCode provider (fallback) ──

const OPENCODE_MODEL = 'muse-spark-1.3-contributor'
const OPENCODE_ENDPOINT = 'https://opencode.ai/inference/go/openai/v1/responses'
const opencodeProvider: AiProvider = {
  id: 'opencode', model: OPENCODE_MODEL,
  isConfigured() { return Boolean(Deno.env.get('OPENCODE_API_KEY')) },
  async request(req) {
    const apiKey = Deno.env.get('OPENCODE_API_KEY')
    if (!apiKey) throwUpstream('AI service is not configured', 503)
    const upstream = await fetch(OPENCODE_ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'x-opencode-session': req.sessionId },
      body: JSON.stringify({
        model: OPENCODE_MODEL,
        instructions: `You are an expert ${req.game} strategist. Rules: ${GAME_RULES[req.game] ?? ""} Think briefly using ThreatSummary and AnnotatedMoves then return only JSON {"move": <one exact legalMoves item>}. RecentMoves: ${(() => { const h = (req.position as Record<string, unknown>).history; return Array.isArray(h) ? JSON.stringify(h.slice(-12)) : "[]"; })()} ThreatSummary: ${threatSummary} AnnotatedMoves: ${JSON.stringify(annotated).slice(0, 2000)}`,
        input: JSON.stringify({ game: req.game, position: req.position, legalMoves: req.legalMoves, history: (req.position as Record<string, unknown>).history ?? [], threatSummary, annotatedMoves: annotated }),
        max_output_tokens: 1024, reasoning: { effort: 'minimal' },
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!upstream.ok) {
      const f = await upstream.json().catch(() => null)
      const code = typeof f?.error?.code === 'string' ? f.error.code : typeof f?.error?.type === 'string' ? f.error.type : undefined
      console.error('[game-ai] OpenCode upstream request failed', upstream.status, code ?? 'unknown')
      throwUpstream('OpenCode upstream request failed', 502, upstream.status, code)
    }
    const result = await upstream.json()
    if (result.status && result.status !== 'completed') {
      const reason = result.incomplete_details?.reason ?? result.status
      console.error('[game-ai] OpenCode response was incomplete', reason, result.usage?.output_tokens ?? 'unknown', result.usage?.output_tokens_details?.reasoning_tokens ?? 'unknown')
      throwUpstream('OpenCode response was incomplete', 502, undefined, undefined, { reason, outputTokens: result.usage?.output_tokens, reasoningTokens: result.usage?.output_tokens_details?.reasoning_tokens })
    }
    const text: string = (result.output ?? []).flatMap((it: { content?: { type?: string; text?: string }[] }) => it.content ?? []).filter((it: { type?: string }) => it.type === 'output_text').map((it: { text?: string }) => it.text ?? '').join('')
    if (!text) { console.error('[game-ai] OpenCode response had no output text', result.status ?? 'unknown'); throwUpstream('OpenCode response had no output text', 502, undefined, undefined, { outputTokens: result.usage?.output_tokens, reasoningTokens: result.usage?.output_tokens_details?.reasoning_tokens }) }
    const parsed = parseJsonObject(text)
    if (!parsed) { console.error('[game-ai] OpenCode response was not valid JSON', text.length); throwUpstream('OpenCode response was not valid JSON', 502) }
    const proposed = (parsed as Record<string, unknown>).move ?? parsed
    const move = req.legalMoves.find((c) => sameMove(c, proposed, req.game))
    if (!move) { console.error('[game-ai] OpenCode response did not match a legal candidate'); throwUpstream('Model did not return a legal candidate', 502) }
    return { provider: 'opencode', model: OPENCODE_MODEL, move }
  },
}

// ── Registry ──

const providers: Record<string, AiProvider> = { baseten: basetenProvider, opencode: opencodeProvider }
function resolveProvider(explicit?: string): { provider: AiProvider } | { error: string; status: number } {
  const norm = explicit?.trim().toLowerCase()
  if (norm && providers[norm]) { const p = providers[norm]; if (!p.isConfigured()) return { error: `AI provider "${norm}" is not configured (missing API key)`, status: 503 }; return { provider: p } }
  if (norm && !providers[norm]) return { error: `Unknown AI provider "${explicit}"`, status: 400 }
  const envPref = (Deno.env.get('AI_PROVIDER') ?? Deno.env.get('CLOUD_AI_PROVIDER') ?? '').trim().toLowerCase()
  if (envPref && providers[envPref]) { const p = providers[envPref]; if (!p.isConfigured()) return { error: `AI provider "${envPref}" is not configured (missing API key)`, status: 503 }; return { provider: p } }
  if (basetenProvider.isConfigured()) return { provider: basetenProvider }
  if (opencodeProvider.isConfigured()) return { provider: opencodeProvider }
  return { provider: basetenProvider } // default so error message points to expected key
}

// ── HTTP handler ──

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!await isAuthenticatedUser(request)) return json({ error: 'Authentication required' }, 401)
  try {
    const { game, sessionKey, position, legalMoves, provider: requestedProvider } = await request.json()
    if (!['gomoku', 'xiangqi', 'chess'].includes(game) || typeof sessionKey !== 'string' || sessionKey.length > 128 || !Array.isArray(legalMoves) || legalMoves.length === 0 || legalMoves.length > 200) {
      return json({ error: 'Invalid game position' }, 400)
    }
    const resolved = resolveProvider(requestedProvider)
    if ('error' in resolved) return json({ error: resolved.error }, resolved.status)
    const active = resolved.provider
    if (!active.isConfigured()) return json({ error: 'AI service is not configured' }, 503)
    const sessionId = await stableSessionId(game, sessionKey, position?.round)
    console.info(`[game-ai] Using provider=${active.id} model=${active.model} game=${game}`)
    const result = await active.request({ game, sessionKey, sessionId, position, legalMoves })
    const usage = (result as unknown as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }).usage
    if (usage) console.info(`[game-ai] usage game=${game} provider=${result.provider} prompt=${usage.prompt_tokens ?? "?"} completion=${usage.completion_tokens ?? "?"} total=${usage.total_tokens ?? "?"}`)
    console.info(`[game-ai] ${result.provider}/${result.model} returned a candidate for ${game}.`)
    return json({ move: result.move, model: result.model, provider: result.provider, usage })
  } catch (error) {
    const err = error as Error & Record<string, unknown>
    const status = typeof err.status === 'number' ? err.status as number : 502
    if (err.upstreamStatus !== undefined) return json({ error: (err.message ?? 'AI request failed') as string, upstreamStatus: err.upstreamStatus, upstreamCode: err.upstreamCode, reason: err.reason, outputTokens: err.outputTokens, reasoningTokens: err.reasoningTokens }, status)
    if (err.reason !== undefined || err.outputTokens !== undefined || err.rawSnippet !== undefined) return json({ error: (err.message ?? 'AI request failed') as string, reason: err.reason, outputTokens: err.outputTokens, reasoningTokens: err.reasoningTokens, rawSnippet: err.rawSnippet }, status)
    const reason = err instanceof Error ? err.name : 'unknown'
    console.error('[game-ai] Function error', reason, err.message)
    return json({ error: (err.message ?? 'AI request failed') as string, reason }, status)
  }
})

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } }) }
async function isAuthenticatedUser(request: Request): Promise<boolean> {
  const authorization = request.headers.get('authorization')
  const projectUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? defaultPublishableKey()
  if (!authorization?.startsWith('Bearer ') || !projectUrl || !anonKey) return false
  try { const r = await fetch(`${projectUrl}/auth/v1/user`, { headers: { authorization, apikey: anonKey } }); return r.ok } catch { return false }
}
function defaultPublishableKey(): string | undefined { try { const k = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}'); return k.default } catch { return undefined } }
async function stableSessionId(game: string, sessionKey: string, round: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify({ game, sessionKey, round }))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return `ses_${Array.from(new Uint8Array(hash).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')}`
}
