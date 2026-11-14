import { getGameList } from './registry'
import type { GameDefinition } from './types'
import type { GamePopularity } from '../lib/gamePopularity'

export interface RankedGame {
  game: GameDefinition
  count: number
  rank: number | null
}

export function rankGames(counts: GamePopularity): RankedGame[] {
  return getGameList()
    .map((game, index) => ({ game, index, count: counts[game.id] ?? 0 }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map(({ game, count }, index) => ({
      game,
      count,
      rank: count > 0 && index < 3 ? index + 1 : null,
    }))
}
