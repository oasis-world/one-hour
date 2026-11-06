import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// ── OpenCode Go (sole provider; Deno.serve, single-file to avoid Supabase bundler issues) ──

type CloudGame = 'gomoku' | 'xiangqi' | 'chess'
type CloudMode = 'move' | 'tutor'
type ProviderRequest = { game: CloudGame; sessionKey: string; sessionId: string; position: unknown; legalMoves: unknown[]; mode: CloudMode; locale?: string; question?: string }
type ProviderResult = { provider: string; model: string; move?: unknown; tutor?: unknown; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }

// ── Helpers shared ──

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

const LOCALE_NAMES: Record<string, string> = {
  zh: 'Simplified Chinese (简体中文)', 'zh-TW': 'Traditional Chinese (繁體中文)', en: 'English',
  ja: 'Japanese (日本語)', fr: 'French (Français)', es: 'Spanish (Español)',
  de: 'German (Deutsch)', ko: 'Korean (한국어)', it: 'Italian (Italiano)', ar: 'Arabic (العربية)',
}
function localeInstruction(locale?: string): string {
  if (!locale) return 'Respond in Simplified Chinese.'
  const name = LOCALE_NAMES[locale] ?? LOCALE_NAMES.en
  return `Respond entirely in ${name}. All natural language fields must be in that language.`
}

// ── Game rules shared by move & tutor prompts ──

const GAME_RULES: Record<string, string> = {
  gomoku: "Gomoku 11x11, stones 1=black 2=white. Black moves first each round. Five in a row (horizontal/vertical/diagonal) wins. Board is Stone[row][col], 0 empty. Prioritize attack (create open-four/live-three) over passive defense; block opponent open-four immediately.",
  xiangqi: "Xiangqi 10x9, board[row][col] 10 rows, red=+ bottom, black=- top. Pieces: 1 General,2 Advisor,3 Elephant,4 Horse,5 Chariot,6 Cannon,7 Soldier. General in 3x3 palace, advisors/elephants cannot cross river, soldiers gain sideways after crossing. Flying general & check rules apply. Red first. Checkmate wins.",
  chess: "Chess 8x8, board[r][c] r0=8th rank(black back), r7=1st rank(white back), c0=a file, c7=h file. Algebraic: a1=bottom-left dark for white (r7c0), h1=bottom-right light (r7c7), e2 = r6c4. Turn w/b. Castling KQkq, enPassant square, halfmove for 50-move. PositionHistory detects repetition. Coordinates are absolute (white perspective): when viewer is black the board is visually flipped (bottom = 8th rank, left→right = h→a) but algebraic remains e2/c3 etc. matched to edge labels. Evaluate material, king safety, center control. Checkmate wins; stalemate/50-move/repetition/insufficient material draws.",
}

// ── OpenCode Go ──

const OPENCODE_MODEL = 'muse-spark-1.3-contributor'
const OPENCODE_ENDPOINT = 'https://opencode.ai/inference/go/openai/v1/responses'

function extractOpenCodeText(result: Record<string, unknown>): string {
  const output = result.output as Array<{ content?: Array<{ type?: string; text?: string }> }> | undefined
  if (!Array.isArray(output)) return ''
  return output
    .flatMap((it) => it.content ?? [])
    .filter((it) => it.type === 'output_text')
    .map((it) => it.text ?? '')
    .join('')
}

async function requestOpenCode(req: ProviderRequest): Promise<ProviderResult> {
  const apiKey = Deno.env.get('OPENCODE_API_KEY')
  if (!apiKey) throwUpstream('AI service is not configured', 503)
  const isTutor = req.mode === 'tutor'
  const maxOutput = isTutor ? 16384 : 2048
  const pos = req.position as Record<string, unknown>
  const threatSummary = typeof pos.threatSummary === 'string' ? pos.threatSummary : ""
  const annotated = Array.isArray(pos.annotatedMoves) ? pos.annotatedMoves : []
  if (isTutor) {
    const localeLine = localeInstruction(req.locale)
    const questionLine = req.question ? ` UserQuestion: ${String(req.question).slice(0, 600)}` : ""
    const viewerColorOc = typeof pos.viewerColor === 'string' ? pos.viewerColor : null
    const turnOc = typeof (pos as Record<string, unknown>).turn === 'string' ? (pos as Record<string, unknown>).turn as string : null
    const moverOc = turnOc === 'w' ? 'b' : turnOc === 'b' ? 'w' : null
    const isOwnLastMoveOc = Boolean(viewerColorOc && moverOc && viewerColorOc === moverOc)
    const viewerHintOc = viewerColorOc ? ` Viewer:${viewerColorOc} turn:${turnOc ?? '-'} lastMoveBy:${moverOc ?? 'none'}${isOwnLastMoveOc ? ' (own move)' : moverOc ? ' (opponent move — do NOT review, set lastMoveReview quality to none)' : ''} (user plays ${viewerColorOc}); coordinates absolute a1=white dark bottom-left, h1 light, e2=r6c4; board flipped for black but algebraic e2/c3 still absolute matching edge labels.` : ""
    const upstream = await fetch(OPENCODE_ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'x-opencode-session': req.sessionId },
      body: JSON.stringify({
        model: OPENCODE_MODEL,
        instructions: `You are an expert ${req.game} tutor for beginners. Rules: ${GAME_RULES[req.game] ?? ""}${viewerHintOc} ${localeLine} Teach this position concisely; recommend for side to move but explain from viewer's perspective. Return ONLY JSON: {"situation":"...","keyThreats":"...","recommendations":[{"move":<legalMoves element>,"label":"...","reason":"..."} x2-3],"conceptTip":"...","lastMoveReview":{"quality":"good|ok|mistake|none","comment":"only review viewer's own last move, otherwise quality none","betterMove":<legalMoves element or null>},"encouragement":"...","answer":"..."}. Every recommendation.move must be exact from legalMoves (absolute algebraic like e2/c3 matching board edge labels). lastMoveReview: ONLY review viewer's own move, else quality none. RecentMoves: ${(() => { const h = (pos as Record<string, unknown>).history; return Array.isArray(h) ? JSON.stringify(h.slice(-12)) : "[]"; })()} ThreatSummary: ${threatSummary.slice(0, 800)} AnnotatedMoves: ${JSON.stringify(annotated).slice(0, 4000)}${questionLine}`,
        input: JSON.stringify({ game: req.game, position: req.position, legalMoves: req.legalMoves, history: (req.position as Record<string, unknown>).history ?? [], threatSummary, annotatedMoves: annotated, question: req.question ?? "" }),
        max_output_tokens: maxOutput, reasoning: { effort: 'minimal' },
      }),
      signal: AbortSignal.timeout(50_000),
    })
    if (!upstream.ok) {
      const f = await upstream.json().catch(() => null)
      const code = typeof f?.error?.code === 'string' ? f.error.code : typeof f?.error?.type === 'string' ? f.error.type : undefined
      console.error('[game-ai] OpenCode tutor upstream failed', upstream.status, code ?? 'unknown')
      throwUpstream('OpenCode upstream request failed', 502, upstream.status, code)
    }
    const result = await upstream.json()
    if (result.status && result.status !== 'completed') {
      const reason = result.incomplete_details?.reason ?? result.status
      console.error('[game-ai] OpenCode tutor incomplete', reason, result.usage?.output_tokens ?? 'unknown', result.usage?.output_tokens_details?.reasoning_tokens ?? 'unknown')
      throwUpstream('OpenCode response was incomplete', 502, undefined, undefined, { reason, outputTokens: result.usage?.output_tokens, reasoningTokens: result.usage?.output_tokens_details?.reasoning_tokens })
    }
    const text = extractOpenCodeText(result as Record<string, unknown>)
    if (!text) { console.error('[game-ai] OpenCode tutor no output text', result.status ?? 'unknown'); throwUpstream('OpenCode response had no output text', 502, undefined, undefined, { outputTokens: result.usage?.output_tokens, reasoningTokens: result.usage?.output_tokens_details?.reasoning_tokens }) }
    const parsed = parseJsonObject(text)
    if (!parsed) { console.error('[game-ai] OpenCode tutor not JSON', text.length); throwUpstream('OpenCode response was not valid JSON', 502) }
    if (Array.isArray(parsed.recommendations)) {
      const filtered = (parsed.recommendations as unknown[]).filter((r) => isRecord(r) && r.move !== undefined).map((r) => {
        const rec = r as Record<string, unknown>
        const matched = req.legalMoves.find((c) => sameMove(c, rec.move, req.game))
        if (!matched) return null
        return { ...rec, move: matched }
      }).filter(Boolean)
      parsed.recommendations = filtered.slice(0, 3) as unknown as typeof parsed.recommendations
    }
    if (isRecord(parsed.lastMoveReview) && parsed.lastMoveReview.betterMove) {
      const bm = parsed.lastMoveReview.betterMove
      const matched = req.legalMoves.find((c) => sameMove(c, bm, req.game))
      parsed.lastMoveReview.betterMove = matched ?? null
    }
    return { provider: 'opencode', model: OPENCODE_MODEL, tutor: parsed }
  }
  const upstream = await fetch(OPENCODE_ENDPOINT, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'x-opencode-session': req.sessionId },
    body: JSON.stringify({
      model: OPENCODE_MODEL,
      instructions: `You are an expert ${req.game} strategist. Rules: ${GAME_RULES[req.game] ?? ""} Think briefly using ThreatSummary and AnnotatedMoves then return only JSON {"move": <one exact legalMoves item>}. RecentMoves: ${(() => { const h = (req.position as Record<string, unknown>).history; return Array.isArray(h) ? JSON.stringify(h.slice(-12)) : "[]"; })()} ThreatSummary: ${threatSummary} AnnotatedMoves: ${JSON.stringify(annotated).slice(0, 2000)}`,
      input: JSON.stringify({ game: req.game, position: req.position, legalMoves: req.legalMoves, history: (req.position as Record<string, unknown>).history ?? [], threatSummary, annotatedMoves: annotated }),
      max_output_tokens: maxOutput, reasoning: { effort: 'minimal' },
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
  const text = extractOpenCodeText(result as Record<string, unknown>)
  if (!text) { console.error('[game-ai] OpenCode response had no output text', result.status ?? 'unknown'); throwUpstream('OpenCode response had no output text', 502, undefined, undefined, { outputTokens: result.usage?.output_tokens, reasoningTokens: result.usage?.output_tokens_details?.reasoning_tokens }) }
  const parsed = parseJsonObject(text)
  if (!parsed) { console.error('[game-ai] OpenCode response was not valid JSON', text.length); throwUpstream('OpenCode response was not valid JSON', 502) }
  const proposed = (parsed as Record<string, unknown>).move ?? parsed
  const move = req.legalMoves.find((c) => sameMove(c, proposed, req.game))
  if (!move) { console.error('[game-ai] OpenCode response did not match a legal candidate'); throwUpstream('Model did not return a legal candidate', 502) }
  return { provider: 'opencode', model: OPENCODE_MODEL, move }
}

// ── HTTP handler ──

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!await isAuthenticatedUser(request)) return json({ error: 'Authentication required' }, 401)
  try {
    const { game, sessionKey, position, legalMoves, mode: requestedMode, locale, question } = await request.json()
    if (!['gomoku', 'xiangqi', 'chess'].includes(game) || typeof sessionKey !== 'string' || sessionKey.length > 128 || !Array.isArray(legalMoves) || legalMoves.length === 0 || legalMoves.length > 200) {
      return json({ error: 'Invalid game position' }, 400)
    }
    const mode: CloudMode = requestedMode === 'tutor' ? 'tutor' : 'move'
    if (!Deno.env.get('OPENCODE_API_KEY')) return json({ error: 'AI service is not configured' }, 503)
    const sessionId = await stableSessionId(game, sessionKey, position?.round)
    console.info(`[game-ai] Using provider=opencode model=${OPENCODE_MODEL} game=${game} mode=${mode}`)
    const result = await requestOpenCode({ game, sessionKey, sessionId, position, legalMoves, mode, locale: typeof locale === 'string' ? locale : undefined, question: typeof question === 'string' ? question : undefined })
    const usage = (result as unknown as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }).usage
    if (usage) console.info(`[game-ai] usage game=${game} provider=${result.provider} mode=${mode} prompt=${usage.prompt_tokens ?? "?"} completion=${usage.completion_tokens ?? "?"} total=${usage.total_tokens ?? "?"}`)
    console.info(`[game-ai] ${result.provider}/${result.model} returned ${mode} result for ${game}.`)
    if (mode === 'tutor') return json({ tutor: result.tutor, model: result.model, provider: result.provider, usage, mode })
    return json({ move: result.move, model: result.model, provider: result.provider, usage, mode })
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
