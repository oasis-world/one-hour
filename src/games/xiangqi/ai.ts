import {
  applyMove, inCheck, legalMoves, pieceType, ROWS, COLS, PIECE, type Move, type Side,
} from './logic'

const VALUE: Record<number, number> = { 1: 10000, 2: 220, 3: 220, 4: 420, 5: 900, 6: 450, 7: 100 }
const MATE = 100000
type Entry = { depth: number; score: number; bound: 'exact' | 'lower' | 'upper'; move?: Move }

function evaluate(board: number[][]): number {
  let score = 0
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const piece = board[r][c]
    if (!piece) continue
    const type = pieceType(piece)
    let value = VALUE[type] ?? 0
    const progress = piece > 0 ? 9 - r : r
    if (type === PIECE.SOLDIER) value += progress * 10 + (progress >= 5 ? 24 : 0)
    if (type === PIECE.HORSE || type === PIECE.CANNON) value += (4 - Math.abs(c - 4)) * 8
    if (type === PIECE.CHARIOT) value += (4 - Math.abs(c - 4)) * 4
    if (type === PIECE.ADVISOR || type === PIECE.ELEPHANT) value += 12
    score += piece > 0 ? value : -value
  }
  if (inCheck(board, 'black')) score += 45
  if (inCheck(board, 'red')) score -= 45
  return score
}

function positionKey(board: number[][], side: Side): string {
  return `${side}:${board.map((row) => row.join(',')).join(';')}`
}

function orderMoves(moves: Move[], board: number[][], preferred?: Move): Move[] {
  const sameMove = (a: Move, b?: Move) => !!b && a.from[0] === b.from[0] && a.from[1] === b.from[1] && a.to[0] === b.to[0] && a.to[1] === b.to[1]
  return moves.sort((a, b) => {
    const score = (m: Move) => {
      if (sameMove(m, preferred)) return 1_000_000
      const victim = board[m.to[0]][m.to[1]]
      if (!victim) return 0
      const attacker = board[m.from[0]][m.from[1]]
      return 10000 + (VALUE[pieceType(victim)] ?? 0) * 10 - (VALUE[pieceType(attacker)] ?? 0)
    }
    return score(b) - score(a)
  })
}

export function chooseAiMove(board: number[][], color: 1 | 2): Move | null {
  const rootSide: Side = color === 1 ? 'red' : 'black'
  const rootMoves = legalMoves(board, rootSide)
  if (rootMoves.length === 0) return null
  const table = new Map<string, Entry>()
  const started = Date.now()
  const deadline = started + 1600
  let stopped = false
  let bestMove = rootMoves[0]

  function quiescence(position: number[][], side: Side, alpha: number, beta: number, remaining: number): number {
    if (Date.now() >= deadline) { stopped = true; return evaluate(position) }
    const checked = inCheck(position, side)
    const stand = evaluate(position)
    const allMoves = legalMoves(position, side)
    if (allMoves.length === 0) return side === 'red' ? -MATE : MATE
    if (!checked) {
      if (side === 'red') { if (stand >= beta) return beta; alpha = Math.max(alpha, stand) }
      else { if (stand <= alpha) return alpha; beta = Math.min(beta, stand) }
      if (remaining <= 0) return stand
    } else if (remaining <= 0) return stand
    const moves = allMoves.filter((move) => checked || position[move.to[0]][move.to[1]] !== 0)
    if (moves.length === 0) return stand
    for (const move of orderMoves(moves, position)) {
      const value = quiescence(applyMove(position, move), side === 'red' ? 'black' : 'red', alpha, beta, remaining - 1)
      if (stopped) break
      if (side === 'red') { alpha = Math.max(alpha, value); if (alpha >= beta) break }
      else { beta = Math.min(beta, value); if (beta <= alpha) break }
    }
    return side === 'red' ? alpha : beta
  }

  function search(position: number[][], side: Side, depth: number, alpha: number, beta: number): number {
    if (Date.now() >= deadline) { stopped = true; return evaluate(position) }
    if (depth <= 0) return quiescence(position, side, alpha, beta, 4)
    const originalAlpha = alpha, originalBeta = beta
    const key = positionKey(position, side)
    const cached = table.get(key)
    if (cached && cached.depth >= depth) {
      if (cached.bound === 'exact') return cached.score
      if (cached.bound === 'lower') alpha = Math.max(alpha, cached.score)
      else beta = Math.min(beta, cached.score)
      if (alpha >= beta) return cached.score
    }
    const moves = orderMoves(legalMoves(position, side), position, cached?.move)
    if (moves.length === 0) return side === 'red' ? -MATE : MATE
    let best = side === 'red' ? -Infinity : Infinity
    let bestCandidate: Move | undefined
    for (const move of moves) {
      const value = search(applyMove(position, move), side === 'red' ? 'black' : 'red', depth - 1, alpha, beta)
      if (stopped) return evaluate(position)
      if (side === 'red' ? value > best : value < best) { best = value; bestCandidate = move }
      if (side === 'red') { alpha = Math.max(alpha, best); if (alpha >= beta) break }
      else { beta = Math.min(beta, best); if (beta <= alpha) break }
    }
    const bound = best <= originalAlpha ? 'upper' : best >= originalBeta ? 'lower' : 'exact'
    table.set(key, { depth, score: best, bound, move: bestCandidate })
    return best
  }

  for (let depth = 1; depth <= 8 && Date.now() < deadline; depth++) {
    const moves = orderMoves(rootMoves.slice(), board, bestMove)
    let iterationBest = bestMove
    let iterationScore = rootSide === 'red' ? -Infinity : Infinity
    let alpha = -Infinity, beta = Infinity
    for (const move of moves) {
      if (Date.now() >= deadline) { stopped = true; break }
      const score = search(applyMove(board, move), rootSide === 'red' ? 'black' : 'red', depth - 1, alpha, beta)
      if (stopped) break
      if (rootSide === 'red' ? score > iterationScore : score < iterationScore) { iterationScore = score; iterationBest = move }
      if (rootSide === 'red') alpha = Math.max(alpha, iterationScore)
      else beta = Math.min(beta, iterationScore)
    }
    if (stopped) break
    bestMove = iterationBest
  }
  return bestMove
}
