import { inCheck, pieceType, pseudoMoves, ROWS, COLS, PIECE, type Side } from '../logic'

export const PIECE_VALUE: Record<number, number> = {
  [PIECE.GENERAL]: 10000,
  [PIECE.ADVISOR]: 220,
  [PIECE.ELEPHANT]: 230,
  [PIECE.HORSE]: 430,
  [PIECE.CHARIOT]: 900,
  [PIECE.CANNON]: 460,
  [PIECE.SOLDIER]: 100,
}

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value))

function addPressure(board: number[][], side: Side, pressure: Uint8Array, cheapestAttacker: Uint16Array): number {
  const moves = pseudoMoves(board, side)
  for (const move of moves) {
    const [toR, toC] = move.to
    const target = board[toR][toC]
    if (!target || (target > 0) === (side === 'red')) continue
    const [fromR, fromC] = move.from
    const square = toR * COLS + toC
    const attackerValue = PIECE_VALUE[pieceType(board[fromR][fromC])] ?? 0
    pressure[square] = Math.min(pressure[square] + 1, 255)
    cheapestAttacker[square] = Math.min(cheapestAttacker[square], attackerValue)
  }
  return moves.length
}

export function evaluate(board: number[][]): number {
  let score = 0
  const redPressure = new Uint8Array(ROWS * COLS)
  const blackPressure = new Uint8Array(ROWS * COLS)
  const redCheapest = new Uint16Array(ROWS * COLS).fill(65535)
  const blackCheapest = new Uint16Array(ROWS * COLS).fill(65535)
  const redMobility = addPressure(board, 'red', redPressure, redCheapest)
  const blackMobility = addPressure(board, 'black', blackPressure, blackCheapest)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const piece = board[r][c]
    if (!piece) continue
    const type = pieceType(piece)
    const progress = piece > 0 ? 9 - r : r
    let value = PIECE_VALUE[type] ?? 0
    if (type === PIECE.SOLDIER) value += progress * 10 + (progress >= 5 ? 32 : 0)
    if (type === PIECE.HORSE || type === PIECE.CANNON) value += (4 - Math.abs(c - 4)) * 7
    if (type === PIECE.CHARIOT) value += (4 - Math.abs(c - 4)) * 4
    if (type === PIECE.ADVISOR) value += 12
    if (type === PIECE.ELEPHANT) value += 16
    const square = r * COLS + c
    const isPressured = piece > 0 ? blackPressure[square] > 0 : redPressure[square] > 0
    if (isPressured) {
      const attacker = piece > 0 ? blackCheapest[square] : redCheapest[square]
      value -= Math.min(65, 18 + Math.max(0, value - attacker) * 0.09)
    }
    score += piece > 0 ? value : -value
  }
  // Mobility contributes modestly, capped so it never outweighs material.
  score += clamp(redMobility - blackMobility, 40) * 1.25
  if (inCheck(board, 'black')) score += 55
  if (inCheck(board, 'red')) score -= 55
  return score
}
