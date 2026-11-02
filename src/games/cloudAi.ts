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
