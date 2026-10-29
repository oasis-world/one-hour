import type { GameDefinition } from './types'
import GomokuGame from './gomoku/GomokuGame'

export const GAMES: GameDefinition[] = [
  {
    id: 'gomoku',
    name: '五子棋',
    nameEn: 'Gomoku',
    icon: '🎯',
    minPlayers: 1,
    maxPlayers: 2,
    Component: GomokuGame,
  },
]

export function getGameById(id: string): GameDefinition | undefined {
  return GAMES.find((g) => g.id === id)
}

export function getGameList(): GameDefinition[] {
  return GAMES
}
