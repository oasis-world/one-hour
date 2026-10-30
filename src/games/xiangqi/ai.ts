import {
  applyMove,
  inCheck,
  legalMoves,
  pieceType,
  ROWS,
  COLS,
  PIECE,
  type Move,
} from './logic'

const VALUE: Record<number, number> = {
  1: 10000,
  2: 220,
  3: 220,
  4: 420,
  5: 900,
  6: 450,
  7: 100,
}

function baseValue(t: number): number {
  return VALUE[t] ?? 0
}

function evalBoard(board: number[][]): number {
  let score = 0
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (p === 0) continue
      const t = pieceType(p)
      let v = baseValue(t)
      if (t === PIECE.SOLDIER) {
        if (p > 0) v += (9 - r) * 8
        else v += r * 8
      }
      if (t === PIECE.HORSE || t === PIECE.CHARIOT) {
        v += (4 - Math.abs(c - 4)) * 2
      }
      if (p > 0) score += v
      else score -= v
    }
  }
  if (inCheck(board, 'black')) score += 60
  if (inCheck(board, 'red')) score -= 60
  return score
}

function orderMoves(moves: Move[], board: number[][]): Move[] {
  return moves
    .map((m) => {
      const cap = board[m.to[0]][m.to[1]]
      let score = 0
      if (cap !== 0) score += 1000 + baseValue(pieceType(cap))
      return { m, score }
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.m)
}

export function chooseAiMove(board: number[][], color: 1 | 2): Move | null {
  const side = color === 1 ? 'red' : 'black'
  const oppSide = color === 1 ? 'black' : 'red'
  const aiMaximizing = side === 'red'
  const moves = legalMoves(board, side)
  if (moves.length === 0) return null
  for (const m of moves) {
    const nb = applyMove(board, m)
    if (legalMoves(nb, oppSide).length === 0) return m
  }

  const timeLimit = 1300
  const start = Date.now()
  const maxDepth = 5
  let bestMove: Move = moves[0]

  function search(b: number[][], d: number, alpha: number, beta: number, maximizing: boolean): number {
    if (Date.now() - start > timeLimit) return evalBoard(b)
    if (d === 0) return evalBoard(b)
    const stm = maximizing ? 'red' : 'black'
    const ms = legalMoves(b, stm)
    if (ms.length === 0) {
      // side to move has no legal moves -> loses (checkmate or stalemate)
      return stm === 'red' ? -100000 : 100000
    }
    const ordered = orderMoves(ms, b)
    if (maximizing) {
      let best = -Infinity
      for (const m of ordered) {
        if (Date.now() - start > timeLimit) break
        const nb = applyMove(b, m)
        const val = search(nb, d - 1, alpha, beta, false)
        if (val > best) best = val
        if (val > alpha) alpha = val
        if (alpha >= beta) break
      }
      return best
    } else {
      let best = Infinity
      for (const m of ordered) {
        if (Date.now() - start > timeLimit) break
        const nb = applyMove(b, m)
        const val = search(nb, d - 1, alpha, beta, true)
        if (val < best) best = val
        if (val < beta) beta = val
        if (alpha >= beta) break
      }
      return best
    }
  }

  for (let target = 1; target <= maxDepth; target++) {
    if (Date.now() - start > timeLimit) break
    const ms = orderMoves(moves.slice(), board)
    let bestScore = aiMaximizing ? -Infinity : Infinity
    let bestM = ms[0]
    let aborted = false
    for (const m of ms) {
      if (Date.now() - start > timeLimit) { aborted = true; break }
      const nb = applyMove(board, m)
      const val = search(nb, target - 1, -Infinity, Infinity, !aiMaximizing)
      const better = aiMaximizing ? val > bestScore : val < bestScore
      if (better) { bestScore = val; bestM = m }
    }
    if (!aborted) bestMove = bestM
  }

  return bestMove
}