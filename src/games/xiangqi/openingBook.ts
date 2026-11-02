import { initialBoard, type Move } from './logic'

// Minimal opening book for Xiangqi — keyed by move count + side
// Each entry is a common opening move for red/black in early game

export const OPENING_BOOK: Record<string, Move> = {
  // Red first moves
  '0:red': { from: [7, 1], to: [7, 4] }, // Central cannon
  '0:red-alt1': { from: [7, 7], to: [7, 4] },
  '1:black': { from: [2, 1], to: [2, 4] }, // Black central cannon response
  '2:red': { from: [9, 1], to: [8, 2] }, // Horse development
  '3:black': { from: [0, 1], to: [1, 3] },
}

export function getOpeningMove(moveHistoryLength: number, side: string): Move | null {
  const key = `${moveHistoryLength}:${side}`
  return OPENING_BOOK[key] ?? null
}

export function isBookPosition(board: number[][], moveCount: number): boolean {
  // Only use book for first 6 plies and near-initial position
  if (moveCount > 6) return false
  // Check board is still close to initial (few pieces moved)
  const init = initialBoard()
  let diff = 0
  for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) if (board[r][c] !== init[r][c]) diff++
  // Allow up to 4 squares changed (2 moves)
  return diff <= 8
}
