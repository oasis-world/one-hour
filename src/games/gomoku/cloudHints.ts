import { BOARD_SIZE, findWinLine, type Stone } from './logic'

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]] as const
const PATTERN_SCORE = [0, 3, 18, 120, 900, 100_000]

function potential(board: Stone[][], r: number, c: number, color: Stone): number {
  let score = 0
  for (const [dr, dc] of DIRS) {
    let count = 1
    let openEnds = 0
    for (const sign of [-1, 1] as const) {
      let rr = r + dr * sign, cc = c + dc * sign
      while (rr >= 0 && rr < BOARD_SIZE && cc >= 0 && cc < BOARD_SIZE && board[rr][cc] === color) {
        count++; rr += dr * sign; cc += dc * sign
      }
      if (rr >= 0 && rr < BOARD_SIZE && cc >= 0 && cc < BOARD_SIZE && board[rr][cc] === 0) openEnds++
    }
    score += PATTERN_SCORE[Math.min(count, 5)] * (openEnds === 2 ? 1.25 : openEnds === 1 ? 1 : 0.35)
  }
  return score
}

export type GomokuHint = {
  r: number; c: number
  isWinningMove: boolean
  isBlockingWin: boolean
  threatScoreSelf: number
  threatScoreOpp: number
  totalLocalScore: number
  centerDistance: number
}

export function buildGomokuHints(board: Stone[][], turn: 1 | 2, legalMoves: { r: number; c: number }[]): { annotatedMoves: GomokuHint[]; threatSummary: string } {
  const opp: Stone = turn === 1 ? 2 : 1
  const color = turn as Stone
  const center = Math.floor(BOARD_SIZE / 2)
  let winCount = 0, blockCount = 0
  const annotated: GomokuHint[] = legalMoves.map(({ r, c }) => {
    const copy = board.map((row) => row.slice()) as Stone[][]
    copy[r][c] = color
    const isWinningMove = !!findWinLine(copy, r, c, color)
    copy[r][c] = opp
    const isBlockingWin = !!findWinLine(copy, r, c, opp)
    copy[r][c] = color
    const threatScoreSelf = Math.round(potential(copy, r, c, color))
    const threatScoreOpp = Math.round(potential(board, r, c, opp))
    const centerDistance = Math.abs(r - center) + Math.abs(c - center)
    const centerBias = BOARD_SIZE - centerDistance
    const totalLocalScore = (isBlockingWin ? 1_000_000 : 0) + threatScoreSelf + threatScoreOpp * 0.92 + centerBias
    if (isWinningMove) winCount++
    if (isBlockingWin) blockCount++
    return { r, c, isWinningMove, isBlockingWin, threatScoreSelf, threatScoreOpp, totalLocalScore: Math.round(totalLocalScore), centerDistance }
  })
  annotated.sort((a, b) => b.totalLocalScore - a.totalLocalScore)
  const top = annotated.slice(0, 5).map((h) => `[${h.r},${h.c}] score=${h.totalLocalScore}`).join(', ')
  const threatSummary = `Gomoku ${BOARD_SIZE}x${BOARD_SIZE}, turn=${turn} (${turn === 1 ? 'black' : 'white'}). Winning moves: ${winCount}, blocking moves: ${blockCount}. Top candidates: ${top || 'none'}.`
  // Keep payload compact: send only top 40
  return { annotatedMoves: annotated.slice(0, 40), threatSummary }
}
