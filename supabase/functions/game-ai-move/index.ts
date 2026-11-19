import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// ── Gemini Developer API (free tier; single-file to avoid Supabase bundler issues) ──

type CloudGame = 'gomoku' | 'xiangqi' | 'chess'
type CloudMode = 'move' | 'tutor'
type ProviderRequest = { game: CloudGame; sessionKey: string; position: unknown; legalMoves: unknown[]; mode: CloudMode; locale?: string; question?: string }
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
// Gemini sometimes returns a coordinate as {row, col}, "r,c" or a full object
// instead of the exact legalMoves element. Try the common representations
// before giving up, keeping the original exact match as the first choice.
function moveCandidates(value: unknown, game: string): unknown[] {
  const out: unknown[] = [value]
  if (game !== 'gomoku') return out
  let pair: [number, number] | null = null
  if (Array.isArray(value) && value.length >= 2) pair = [Number(value[0]), Number(value[1])]
  else if (isRecord(value)) {
    const row = value.row ?? value.r ?? value.y
    const col = value.col ?? value.c ?? value.x
    if (row !== undefined && col !== undefined) pair = [Number(row), Number(col)]
  } else if (typeof value === 'string') {
    const match = value.match(/(\d+)\s*[,，]\s*(\d+)/)
    if (match) pair = [Number(match[1]), Number(match[2])]
  }
  if (pair && Number.isFinite(pair[0]) && Number.isFinite(pair[1])) {
    out.push(pair, `${pair[0]},${pair[1]}`, { row: pair[0], col: pair[1] }, { r: pair[0], c: pair[1] })
  }
  return out
}
function findLegalMove(legalMoves: unknown[], proposed: unknown, game: string): unknown | undefined {
  for (const candidate of moveCandidates(proposed, game)) {
    const found = legalMoves.find((item) => sameMove(item, candidate, game))
    if (found) return found
  }
  return undefined
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

// ── Gemini ──

const GEMINI_MODEL = 'gemini-3.5-flash-lite'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

function extractGeminiText(result: Record<string, unknown>): string {
  const candidates = result.candidates as Array<{ content?: { parts?: Array<{ text?: unknown }> } }> | undefined
  const parts = candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('')
}
function geminiUsage(result: Record<string, unknown>): ProviderResult['usage'] {
  const u = result.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined
  if (!u) return undefined
  return { prompt_tokens: u.promptTokenCount, completion_tokens: u.candidatesTokenCount, total_tokens: u.totalTokenCount }
}

async function requestGemini(req: ProviderRequest): Promise<ProviderResult> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
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
    const systemInstruction = `You are an expert ${req.game} tutor for beginners. Rules: ${GAME_RULES[req.game] ?? ""}${viewerHintOc} ${localeLine} Teach this position concisely; recommend for side to move but explain from viewer's perspective. Return ONLY JSON: {"situation":"...","keyThreats":"...","recommendations":[{"move":<legalMoves element>,"label":"...","reason":"..."} x2-3],"conceptTip":"...","lastMoveReview":{"quality":"good|ok|mistake|none","comment":"only review viewer's own last move, otherwise quality none","betterMove":<legalMoves element or null>},"encouragement":"...","answer":"..."}. Every recommendation.move must be exact from legalMoves (absolute algebraic like e2/c3 matching board edge labels). lastMoveReview: ONLY review viewer's own move, else quality none. RecentMoves: ${(() => { const h = (pos as Record<string, unknown>).history; return Array.isArray(h) ? JSON.stringify(h.slice(-12)) : "[]"; })()} ThreatSummary: ${threatSummary.slice(0, 800)} AnnotatedMoves: ${JSON.stringify(annotated).slice(0, 4000)}${questionLine}`
    const upstream = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify({ game: req.game, position: req.position, legalMoves: req.legalMoves, history: (req.position as Record<string, unknown>).history ?? [], threatSummary, annotatedMoves: annotated, question: req.question ?? "" }) }] }],
        generationConfig: { maxOutputTokens: maxOutput, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(50_000),
    })
    if (!upstream.ok) {
      const f = await upstream.json().catch(() => null)
      const code = typeof f?.error?.message === 'string' ? f.error.message : typeof f?.error?.status === 'string' ? f.error.status : undefined
      console.error('[game-ai] Gemini tutor upstream failed', upstream.status, code ?? 'unknown')
      throwUpstream('Gemini upstream request failed', 502, upstream.status, code)
    }
    const result = await upstream.json() as Record<string, unknown>
    const text = extractGeminiText(result)
    if (!text) { console.error('[game-ai] Gemini tutor no output text'); throwUpstream('Gemini response had no output text', 502) }
    const parsed = parseJsonObject(text)
    if (!parsed) { console.error('[game-ai] Gemini tutor not JSON', text.length); throwUpstream('Gemini response was not valid JSON', 502) }
    if (Array.isArray(parsed.recommendations)) {
      const filtered = (parsed.recommendations as unknown[]).filter((r) => isRecord(r) && r.move !== undefined).map((r) => {
        const rec = r as Record<string, unknown>
        const matched = findLegalMove(req.legalMoves, rec.move, req.game)
        if (!matched) return null
        return { ...rec, move: matched }
      }).filter(Boolean)
      parsed.recommendations = filtered.slice(0, 3) as unknown as typeof parsed.recommendations
    }
    if (isRecord(parsed.lastMoveReview) && parsed.lastMoveReview.betterMove) {
      const bm = parsed.lastMoveReview.betterMove
      const matched = findLegalMove(req.legalMoves, bm, req.game)
      parsed.lastMoveReview.betterMove = matched ?? null
    }
    return { provider: 'gemini', model: GEMINI_MODEL, tutor: parsed, usage: geminiUsage(result) }
  }
  const systemInstruction = `You are an expert ${req.game} strategist. Rules: ${GAME_RULES[req.game] ?? ""} Think briefly using ThreatSummary and AnnotatedMoves then return only JSON {"move": <one exact legalMoves item>}. RecentMoves: ${(() => { const h = (req.position as Record<string, unknown>).history; return Array.isArray(h) ? JSON.stringify(h.slice(-12)) : "[]"; })()} ThreatSummary: ${threatSummary} AnnotatedMoves: ${JSON.stringify(annotated).slice(0, 2000)}`
  const upstream = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify({ game: req.game, position: req.position, legalMoves: req.legalMoves, history: (req.position as Record<string, unknown>).history ?? [], threatSummary, annotatedMoves: annotated }) }] }],
      generationConfig: { maxOutputTokens: maxOutput, responseMimeType: 'application/json' },
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!upstream.ok) {
    const f = await upstream.json().catch(() => null)
    const code = typeof f?.error?.message === 'string' ? f.error.message : typeof f?.error?.status === 'string' ? f.error.status : undefined
    console.error('[game-ai] Gemini upstream request failed', upstream.status, code ?? 'unknown')
    throwUpstream('Gemini upstream request failed', 502, upstream.status, code)
  }
  const result = await upstream.json() as Record<string, unknown>
  const text = extractGeminiText(result)
  if (!text) { console.error('[game-ai] Gemini response had no output text'); throwUpstream('Gemini response had no output text', 502) }
  const parsed = parseJsonObject(text)
  if (!parsed) { console.error('[game-ai] Gemini response was not valid JSON', text.length); throwUpstream('Gemini response was not valid JSON', 502) }
  const proposed = (parsed as Record<string, unknown>).move ?? parsed
  const move = findLegalMove(req.legalMoves, proposed, req.game)
  if (!move) {
    console.error('[game-ai] Gemini move mismatch', JSON.stringify({ proposed, legalFirst: req.legalMoves.slice(0, 6), game: req.game }).slice(0, 1500))
    throwUpstream('Model did not return a legal candidate', 502)
  }
  return { provider: 'gemini', model: GEMINI_MODEL, move, usage: geminiUsage(result) }
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
    if (!Deno.env.get('GEMINI_API_KEY')) return json({ error: 'AI service is not configured' }, 503)
    console.info(`[game-ai] Using provider=gemini model=${GEMINI_MODEL} game=${game} mode=${mode}`)
    const result = await requestGemini({ game, sessionKey, position, legalMoves, mode, locale: typeof locale === 'string' ? locale : undefined, question: typeof question === 'string' ? question : undefined })
    const usage = result.usage
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
