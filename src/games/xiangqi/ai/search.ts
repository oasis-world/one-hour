import { applyMove, inCheck, legalMoves, pieceType, ROWS, COLS, type Move, type Side } from '../logic'
import { evaluate, PIECE_VALUE } from './evaluate'

const MATE = 100000
const MAX_PLY = 64
type Bound = 'exact' | 'lower' | 'upper'
type Entry = { depth: number; score: number; bound: Bound; move?: Move }
type ScoredMove = { move: Move; score: number }

const zobristA: Uint32Array[] = []
const zobristB: Uint32Array[] = []
let randomState = 0x9e3779b9
function nextRandom(): number {
  randomState ^= randomState << 13
  randomState ^= randomState >>> 17
  randomState ^= randomState << 5
  return randomState >>> 0
}
for (let piece = 0; piece < 14; piece++) {
  zobristA.push(Uint32Array.from({ length: ROWS * COLS }, nextRandom))
  zobristB.push(Uint32Array.from({ length: ROWS * COLS }, nextRandom))
}
const sideHashA = nextRandom(), sideHashB = nextRandom()

function pieceIndex(piece: number): number { return piece > 0 ? piece - 1 : 7 + -piece - 1 }
function boardHash(board: number[][], side: Side): [number, number] {
  let a = 0, b = 0
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const piece = board[r][c]
    if (!piece) continue
    const index = pieceIndex(piece), square = r * COLS + c
    a ^= zobristA[index][square]
    b ^= zobristB[index][square]
  }
  if (side === 'black') { a ^= sideHashA; b ^= sideHashB }
  return [a >>> 0, b >>> 0]
}
function childHash(a: number, b: number, board: number[][], move: Move): [number, number] {
  const [fromR, fromC] = move.from, [toR, toC] = move.to
  const moving = board[fromR][fromC], captured = board[toR][toC]
  const from = fromR * COLS + fromC, to = toR * COLS + toC
  const movingIndex = pieceIndex(moving)
  a ^= zobristA[movingIndex][from] ^ zobristA[movingIndex][to] ^ sideHashA
  b ^= zobristB[movingIndex][from] ^ zobristB[movingIndex][to] ^ sideHashB
  if (captured) {
    const capturedIndex = pieceIndex(captured)
    a ^= zobristA[capturedIndex][to]
    b ^= zobristB[capturedIndex][to]
  }
  return [a >>> 0, b >>> 0]
}
function hashKey(a: number, b: number): string { return `${a}:${b}` }
function moveCode(move: Move, side: Side): number {
  return (side === 'red' ? 0 : 8100) + (move.from[0] * COLS + move.from[1]) * 90 + move.to[0] * COLS + move.to[1]
}
function sameMove(a: Move, b?: Move): boolean {
  return !!b && a.from[0] === b.from[0] && a.from[1] === b.from[1] && a.to[0] === b.to[0] && a.to[1] === b.to[1]
}

export function chooseAiMove(board: number[][], color: 1 | 2, timeLimitMs = 2800): Move | null {
  const rootSide: Side = color === 1 ? 'red' : 'black'
  const rootMoves = legalMoves(board, rootSide)
  if (rootMoves.length === 0) return null
  const table = new Map<string, Entry>()
  const history = new Map<number, number>()
  const killers: Array<[Move?, Move?]> = Array.from({ length: MAX_PLY }, () => [])
  const deadline = Date.now() + timeLimitMs
  let nodes = 0, stopped = false
  let bestMove = rootMoves[0]
  let completedScores: ScoredMove[] = []

  function orderMoves(moves: Move[], position: number[][], side: Side, ply: number, preferred?: Move): Move[] {
    const killer = killers[Math.min(ply, MAX_PLY - 1)] ?? []
    const scored = moves.map((move) => {
      if (sameMove(move, preferred)) return { move, score: 1_000_000_000 }
      const victim = position[move.to[0]][move.to[1]]
      if (victim) {
        const attacker = position[move.from[0]][move.from[1]]
        return { move, score: 100_000 + (PIECE_VALUE[pieceType(victim)] ?? 0) * 10 - (PIECE_VALUE[pieceType(attacker)] ?? 0) }
      }
      if (sameMove(move, killer[0])) return { move, score: 90_000 }
      if (sameMove(move, killer[1])) return { move, score: 80_000 }
      return { move, score: history.get(moveCode(move, side)) ?? 0 }
    })
    scored.sort((a, b) => b.score - a.score)
    return scored.map((item) => item.move)
  }

  function rememberCutoff(position: number[][], move: Move, side: Side, ply: number, depth: number): void {
    if (position[move.to[0]][move.to[1]] !== 0) return
    const pair = killers[Math.min(ply, MAX_PLY - 1)]
    if (!sameMove(move, pair[0])) { pair[1] = pair[0]; pair[0] = move }
    const code = moveCode(move, side)
    history.set(code, Math.min(1_000_000, (history.get(code) ?? 0) + depth * depth))
  }

  function quiescence(position: number[][], side: Side, alpha: number, beta: number, remaining: number, ply: number): number {
    if ((++nodes & 255) === 0 && Date.now() >= deadline) { stopped = true; return evaluate(position) }
    const checked = inCheck(position, side)
    const stand = evaluate(position)
    const moves = legalMoves(position, side)
    if (moves.length === 0) return side === 'red' ? -MATE + ply : MATE - ply
    if (!checked) {
      if (side === 'red') { if (stand >= beta) return beta; alpha = Math.max(alpha, stand) }
      else { if (stand <= alpha) return alpha; beta = Math.min(beta, stand) }
      if (remaining <= 0 || ply >= MAX_PLY - 1) return stand
    }
    const tactical = checked ? moves : moves.filter((move) => position[move.to[0]][move.to[1]] !== 0)
    if (tactical.length === 0) return stand
    for (const move of orderMoves(tactical, position, side, ply)) {
      const value = quiescence(applyMove(position, move), side === 'red' ? 'black' : 'red', alpha, beta, remaining - 1, ply + 1)
      if (stopped) break
      if (side === 'red') { alpha = Math.max(alpha, value); if (alpha >= beta) break }
      else { beta = Math.min(beta, value); if (beta <= alpha) break }
    }
    return side === 'red' ? alpha : beta
  }

  function search(position: number[][], side: Side, depth: number, alpha: number, beta: number, ply: number, hashA: number, hashB: number): number {
    if ((++nodes & 255) === 0 && Date.now() >= deadline) { stopped = true; return evaluate(position) }
    if (depth <= 0 || ply >= MAX_PLY - 1) return quiescence(position, side, alpha, beta, 5, ply)
    const originalAlpha = alpha, originalBeta = beta
    const key = hashKey(hashA, hashB)
    const cached = table.get(key)
    if (cached && cached.depth >= depth) {
      if (cached.bound === 'exact') return cached.score
      if (cached.bound === 'lower') alpha = Math.max(alpha, cached.score)
      else beta = Math.min(beta, cached.score)
      if (alpha >= beta) return cached.score
    }
    const moves = orderMoves(legalMoves(position, side), position, side, ply, cached?.move)
    if (moves.length === 0) return side === 'red' ? -MATE + ply : MATE - ply
    let best = side === 'red' ? -Infinity : Infinity
    let bestMoveHere: Move | undefined
    for (let index = 0; index < moves.length; index++) {
      const move = moves[index]
      const [nextA, nextB] = childHash(hashA, hashB, position, move)
      const next = applyMove(position, move)
      const nextSide: Side = side === 'red' ? 'black' : 'red'
      let value: number
      if (index === 0) value = search(next, nextSide, depth - 1, alpha, beta, ply + 1, nextA, nextB)
      else if (side === 'red') {
        value = search(next, nextSide, depth - 1, alpha, Math.min(alpha + 1, beta), ply + 1, nextA, nextB)
        if (!stopped && value > alpha && value < beta) value = search(next, nextSide, depth - 1, alpha, beta, ply + 1, nextA, nextB)
      } else {
        value = search(next, nextSide, depth - 1, Math.max(beta - 1, alpha), beta, ply + 1, nextA, nextB)
        if (!stopped && value < beta && value > alpha) value = search(next, nextSide, depth - 1, alpha, beta, ply + 1, nextA, nextB)
      }
      if (stopped) return evaluate(position)
      if (side === 'red' ? value > best : value < best) { best = value; bestMoveHere = move }
      if (side === 'red') alpha = Math.max(alpha, best)
      else beta = Math.min(beta, best)
      if (alpha >= beta) { rememberCutoff(position, move, side, ply, depth); break }
    }
    const bound: Bound = best <= originalAlpha ? 'upper' : best >= originalBeta ? 'lower' : 'exact'
    table.set(key, { depth, score: best, bound, move: bestMoveHere })
    return best
  }

  const [rootHashA, rootHashB] = boardHash(board, rootSide)
  for (let depth = 1; depth <= 12 && Date.now() < deadline; depth++) {
    const moves = orderMoves(rootMoves.slice(), board, rootSide, 0, bestMove)
    let iterationBest = bestMove
    let iterationScore = rootSide === 'red' ? -Infinity : Infinity
    const iterationScores: ScoredMove[] = []
    for (const move of moves) {
      if (Date.now() >= deadline) { stopped = true; break }
      const [nextA, nextB] = childHash(rootHashA, rootHashB, board, move)
      const score = search(applyMove(board, move), rootSide === 'red' ? 'black' : 'red', depth - 1, -Infinity, Infinity, 1, nextA, nextB)
      if (stopped) break
      iterationScores.push({ move, score })
      if (rootSide === 'red' ? score > iterationScore : score < iterationScore) { iterationScore = score; iterationBest = move }
    }
    if (stopped) break
    bestMove = iterationBest
    completedScores = iterationScores
  }

  if (completedScores.length < 2) return bestMove
  const strongest = rootSide === 'red'
    ? Math.max(...completedScores.map((candidate) => candidate.score))
    : Math.min(...completedScores.map((candidate) => candidate.score))
  // Keep variety only among independently full-window-scored near ties.
  const shortlist = completedScores.filter((candidate) => Math.abs(candidate.score - strongest) <= 8)
  if (shortlist.length < 2) return bestMove
  const total = shortlist.reduce((sum, candidate) => sum + Math.exp(-Math.abs(candidate.score - strongest) / 3), 0)
  let pick = Math.random() * total
  for (const candidate of shortlist) {
    pick -= Math.exp(-Math.abs(candidate.score - strongest) / 3)
    if (pick <= 0) return candidate.move
  }
  return bestMove
}
