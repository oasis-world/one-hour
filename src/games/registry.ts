import type { GameDefinition } from './types'
import GomokuGame from './gomoku/GomokuGame'
import XiangqiGame from './xiangqi/XiangqiGame'
import ChessGame from './chess/ChessGame'
import SolitaireGame from './solitaire/SolitaireGame'
import SudokuGame from './sudoku/SudokuGame'
import { GomokuIcon, XiangqiGeneralIcon, ChessCrownIcon } from '../components/icons'
import SolitaireIcon from './solitaire/SolitaireIcon'
import SudokuIcon from './sudoku/SudokuIcon'

export const GAMES: GameDefinition[] = [
  {
    id: 'gomoku',
    name: '五子棋',
    nameEn: 'Gomoku',
    icon: '🎯',
    Icon: GomokuIcon,
    tagline: '经典五连珠',
    taglineEn: 'Classic five-in-a-row',
    minPlayers: 1,
    maxPlayers: 2,
    Component: GomokuGame,
  },
  {
    id: 'xiangqi',
    name: '中国象棋',
    nameEn: 'Chinese Chess',
    icon: '♟',
    Icon: XiangqiGeneralIcon,
    tagline: '楚河汉界',
    taglineEn: 'River & border battle',
    minPlayers: 1,
    maxPlayers: 2,
    Component: XiangqiGame,
  },
  {
    id: 'chess',
    name: '国际象棋',
    nameEn: 'Chess',
    icon: '♔',
    Icon: ChessCrownIcon,
    tagline: '策略与战术',
    taglineEn: 'Strategy & tactics',
    minPlayers: 1,
    maxPlayers: 2,
    Component: ChessGame,
  },
  {
    id: 'solitaire',
    name: '纸牌接龙',
    nameEn: 'Solitaire',
    icon: '🂡',
    Icon: SolitaireIcon,
    tagline: '经典克朗代克单人纸牌',
    taglineEn: 'A classic solo card game',
    minPlayers: 1,
    maxPlayers: 1,
    Component: SolitaireGame,
  },
  {
    id: 'sudoku',
    name: '数独',
    nameEn: 'Sudoku',
    icon: '▦',
    Icon: SudokuIcon,
    tagline: '专注逻辑，享受解题',
    taglineEn: 'A little logic, a lot of focus',
    minPlayers: 1,
    maxPlayers: 1,
    Component: SudokuGame,
  },
]

export function getGameById(id: string): GameDefinition | undefined {
  return GAMES.find((g) => g.id === id)
}

export function getGameList(): GameDefinition[] {
  return GAMES
}
