import { BOARD_SIZE, findWinLine, type Stone } from './logic'

const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]] as const
const PATTERN_SCORE = [0, 3, 18, 120, 900, 100_000]

function potential(board: Stone[][], r: number, c: number, color: Stone): number {
  let score = 0
  for (const [dr, dc] of DIRECTIONS) {
    let count = 1
    let openEnds = 0
    for (const sign of [-1, 1]) {
      let rr = r + dr * sign
      let cc = c + dc * sign
      while (rr >= 0 && rr < BOARD_SIZE && cc >= 0 && cc < BOARD_SIZE && board[rr][cc] === color) {
        count++
        rr += dr * sign
        cc += dc * sign
      }
      if (rr >= 0 && rr < BOARD_SIZE && cc >= 0 && cc < BOARD_SIZE && board[rr][cc] === 0) openEnds++
    }
    score += PATTERN_SCORE[Math.min(count, 5)] * (openEnds === 2 ? 1.25 : openEnds === 1 ? 1 : 0.35)
  }
  return score
}

export function chooseAiMove(board: Stone[][], color: 1 | 2): { r: number; c: number } {
  const opponent: Stone = color === 1 ? 2 : 1
  let best = { r: Math.floor(BOARD_SIZE / 2), c: Math.floor(BOARD_SIZE / 2) }
  let bestScore = -Infinity

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== 0) continue
      const copy = board.map((row) => row.slice())
      copy[r][c] = color
      if (findWinLine(copy, r, c, color)) return { r, c }
      copy[r][c] = opponent
      const blocksWin = findWinLine(copy, r, c, opponent) ? 1_000_000 : 0
      copy[r][c] = color
      const center = Math.floor(BOARD_SIZE / 2)
      const centerBias = BOARD_SIZE - Math.abs(r - center) - Math.abs(c - center)
      const score = blocksWin + potential(copy, r, c, color) + potential(board, r, c, opponent) * 0.92 + centerBias
      if (score > bestScore) {
        best = { r, c }
        bestScore = score
      }
    }
  }
  return best
}
