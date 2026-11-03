import { getSupabaseClient } from '../lib/supabaseClient'

export type CloudGame = 'gomoku' | 'xiangqi' | 'chess'

/** Ask the server-side AI proxy for a candidate. Callers must validate it. */
export async function requestCloudMove<T>(
  game: CloudGame,
  sessionKey: string,
  position: unknown,
  legalMoves: T[],
  isHost: () => boolean,
): Promise<T | null> {
  if (legalMoves.length === 0) return null
  if (!isHost()) {
    console.warn(`[game-ai] Skipped cloud request for ${game}: this tab is not the active host.`)
    return null
  }
  const client = await getSupabaseClient()
  const { data, error } = await client.functions.invoke('game-ai-move', {
    body: { game, sessionKey, position, legalMoves },
  })
  if (error) {
    let detail = error.message
    if (error.context instanceof Response) {
      const body = await error.context.clone().json().catch(() => null)
      if (typeof body?.error === 'string') detail = body.error
      if (typeof body?.upstreamStatus === 'number') detail += ` (upstream HTTP ${body.upstreamStatus})`
      if (typeof body?.upstreamCode === 'string') detail += ` [${body.upstreamCode}]`
      if (typeof body?.reason === 'string') detail += ` (${body.reason})`
      if (typeof body?.rawSnippet === 'string') detail += ` raw=${body.rawSnippet.slice(0, 300)}`
      if (typeof body?.outputTokens === 'number' && typeof body?.reasoningTokens === 'number') {
        detail += ` (${body.reasoningTokens}/${body.outputTokens} output tokens were reasoning)`
      }
    }
    console.warn(`[game-ai] Cloud request failed for ${game}; using local AI.`, detail)
    throw error
  }
  if (!data?.move) {
    console.warn(`[game-ai] Cloud AI returned no legal move for ${game}; using local AI.`)
    return null
  }
  const provider = typeof data.provider === 'string' ? data.provider : 'unknown'
  const model = typeof data.model === 'string' ? data.model : 'unknown'
  const usage = (data as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }).usage
  if (usage) console.info(`[game-ai] usage game=${game} provider=${provider} prompt=${usage.prompt_tokens ?? '?'} completion=${usage.completion_tokens ?? '?'} total=${usage.total_tokens ?? '?'}`)
  console.info(`[game-ai] ${provider}/${model} returned a candidate for ${game}.`)
  return data.move
}

// ── Tutor types & helper ──

export type TutorRecommendation<M = unknown> = { move: M; label: string; reason: string }
export type TutorResult<M = unknown> = {
  situation: string
  keyThreats: string
  recommendations: TutorRecommendation<M>[]
  conceptTip: string
  lastMoveReview: { quality: 'good' | 'ok' | 'mistake' | 'none'; comment: string; betterMove: M | null }
  encouragement: string
  answer: string
}

function canonicalMove(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalMove).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, val]) => `${JSON.stringify(k)}:${canonicalMove(val)}`).join(',')}}`
  return JSON.stringify(v)
}
function sameTutorMove(a: unknown, b: unknown, game: string): boolean {
  if (game === 'gomoku') return canonicalMove(a) === canonicalMove(b)
  if (!a || typeof a !== 'object' || !b || typeof b !== 'object') return false
  const ra = a as Record<string, unknown>, rb = b as Record<string, unknown>
  return canonicalMove(ra.from) === canonicalMove(rb.from) && canonicalMove(ra.to) === canonicalMove(rb.to)
}

function extractErrorDetail(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error)
  const e = error as { context?: unknown }
  if (e.context instanceof Response) {
    // will be read async by caller if needed; here just fallback
  }
  return detail
}

export async function requestChessTutor<M>(
  game: CloudGame,
  sessionKey: string,
  position: unknown,
  legalMoves: M[],
  opts: { locale?: string; question?: string },
): Promise<TutorResult<M>> {
  const client = await getSupabaseClient()
  const { data, error } = await client.functions.invoke('game-ai-move', {
    body: { game, sessionKey, position, legalMoves, mode: 'tutor', locale: opts.locale ?? 'zh', question: opts.question ?? undefined },
  })
  if (error) {
    let detail = error.message
    if (error.context instanceof Response) {
      const body = await error.context.clone().json().catch(() => null)
      if (typeof body?.error === 'string') detail = body.error
      if (typeof body?.reason === 'string') detail += ` (${body.reason})`
    }
    throw new Error(detail)
  }
  const raw = data?.tutor as Record<string, unknown> | undefined
  if (!raw || typeof raw !== 'object') throw new Error(extractErrorDetail(data?.error ?? 'Tutor returned no data'))
  // Validate & remap moves to legalMoves (defense against hallucinated coords)
  const recommendations: TutorRecommendation<M>[] = []
  if (Array.isArray(raw.recommendations)) {
    for (const r of raw.recommendations as Record<string, unknown>[]) {
      if (!r || typeof r !== 'object' || !r.move) continue
      const matched = legalMoves.find((c) => sameTutorMove(c, r.move, game))
      if (!matched) continue
      recommendations.push({ move: matched, label: typeof r.label === 'string' ? r.label : '', reason: typeof r.reason === 'string' ? r.reason : '' })
    }
  }
  let betterMove: M | null = null
  const lmr = raw.lastMoveReview as Record<string, unknown> | undefined
  if (lmr?.betterMove) {
    const bm = lmr.betterMove
    betterMove = (legalMoves.find((c) => sameTutorMove(c, bm, game)) as M) ?? null
  }
  const result: TutorResult<M> = {
    situation: typeof raw.situation === 'string' ? raw.situation : '',
    keyThreats: typeof raw.keyThreats === 'string' ? raw.keyThreats : '',
    recommendations: recommendations.slice(0, 3),
    conceptTip: typeof raw.conceptTip === 'string' ? raw.conceptTip : '',
    lastMoveReview: {
      quality: ((): TutorResult<M>['lastMoveReview']['quality'] => {
        const q = lmr?.quality
        return q === 'good' || q === 'ok' || q === 'mistake' || q === 'none' ? q : 'none'
      })(),
      comment: typeof lmr?.comment === 'string' ? lmr.comment : '',
      betterMove,
    },
    encouragement: typeof raw.encouragement === 'string' ? raw.encouragement : '',
    answer: typeof raw.answer === 'string' ? raw.answer : '',
  }
  const usage = (data as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }).usage
  if (usage) console.info(`[game-ai] tutor usage game=${game} prompt=${usage.prompt_tokens ?? '?'} completion=${usage.completion_tokens ?? '?'} total=${usage.total_tokens ?? '?'}`)
  return result
}
