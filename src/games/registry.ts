import type { GameDefinition } from './types'
import GomokuGame from './gomoku/GomokuGame'
import XiangqiGame from './xiangqi/XiangqiGame'
import ChessGame from './chess/ChessGame'

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
  {
    id: 'xiangqi',
    name: '中国象棋',
    nameEn: 'Chinese Chess',
    icon: '♟',
    minPlayers: 1,
    maxPlayers: 2,
    Component: XiangqiGame,
  },
  {
    id: 'chess',
    name: '国际象棋',
    nameEn: 'Chess',
    icon: '♔',
    minPlayers: 1,
    maxPlayers: 2,
    Component: ChessGame,
  },
]

export function getGameById(id: string): GameDefinition | undefined {
  return GAMES.find((g) => g.id === id)
}

export function getGameList(): GameDefinition[] {
  return GAMES
}
