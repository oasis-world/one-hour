import { getSupabaseClient } from '../lib/supabaseClient'

export type CloudGame = 'gomoku' | 'xiangqi' | 'chess'

/** Ask the server-side OpenCode proxy for a candidate. Callers must validate it. */
export async function requestCloudMove<T>(game: CloudGame, sessionKey: string, position: unknown, legalMoves: T[], isHost: () => boolean): Promise<T | null> {
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
      if (typeof body?.upstreamStatus === 'number') detail += ` (OpenCode HTTP ${body.upstreamStatus})`
      if (typeof body?.upstreamCode === 'string') detail += ` [${body.upstreamCode}]`
      if (typeof body?.reason === 'string') detail += ` (${body.reason})`
      if (typeof body?.outputTokens === 'number' && typeof body?.reasoningTokens === 'number') {
        detail += ` (${body.reasoningTokens}/${body.outputTokens} output tokens were reasoning)`
      }
    }
    console.warn(`[game-ai] OpenCode request failed for ${game}; using local AI.`, detail)
    throw error
  }
  if (!data?.move) {
    console.warn(`[game-ai] OpenCode returned no legal move for ${game}; using local AI.`)
    return null
  }
  console.info(`[game-ai] OpenCode ${data.model ?? 'Muse Spark 1.3 Contributor'} returned a candidate for ${game}.`)
  return data.move
}
