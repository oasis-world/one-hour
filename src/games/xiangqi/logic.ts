// Chinese chess (Xiangqi) rules engine.
// Board: 10 rows (0 top = black side), 9 cols. Red moves first (bottom).
// Piece encoding (signed int): 0 empty; red +1..+7, black -1..-7.
//   1/ -1 general, 2/-2 advisor, 3/-3 elephant, 4/-4 horse, 5/-5 chariot,
//   6/-6 cannon, 7/-7 soldier.

export const ROWS = 10
export const COLS = 9

export type Side = 'red' | 'black'
export type Move = { from: [number, number]; to: [number, number] }

export const PIECE = {
  GENERAL: 1,
  ADVISOR: 2,
  ELEPHANT: 3,
  HORSE: 4,
  CHARIOT: 5,
  CANNON: 6,
  SOLDIER: 7,
} as const

export interface XiangqiPlayer {
  userId: string
  displayName: string
  avatarUrl: string | null
  avatarStyle?: string | null
  avatarSeed?: string | null
  color: 1 | 2 // 1 red, 2 black
  score: number
  joinedAt: number
  isAI?: boolean
}

export interface XiangqiState {
  instanceId: string
  hostId: string
  players: XiangqiPlayer[]
  board: number[][]
  turn: 1 | 2 // 1 red, 2 black
  status: 'waiting' | 'playing' | 'result'
  winnerId: string | null
  lastMove: Move | null
  round: number
}

export function emptyBoard(): number[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0))
}

export function initialBoard(): number[][] {
  const b = emptyBoard()
  // black (top)
  b[0] = [-5, -4, -3, -2, -1, -2, -3, -4, -5]
  b[2][1] = -6; b[2][7] = -6
  for (let c = 0; c < COLS; c += 2) b[3][c] = -7
  // red (bottom)
  b[9] = [5, 4, 3, 2, 1, 2, 3, 4, 5]
  b[7][1] = 6; b[7][7] = 6
  for (let c = 0; c < COLS; c += 2) b[6][c] = 7
  return b
}

export function createInitialState(instanceId: string, hostId: string): XiangqiState {
  return {
    instanceId,
    hostId,
    players: [],
    board: initialBoard(),
    turn: 1,
    status: 'waiting',
    winnerId: null,
    lastMove: null,
    round: 1,
  }
}

export function sideOfColor(color: 1 | 2): Side {
  return color === 1 ? 'red' : 'black'
}
export function colorOfSide(side: Side): 1 | 2 {
  return side === 'red' ? 1 : 2
}
export function isRed(piece: number): boolean {
  return piece > 0
}
export function pieceSide(piece: number): Side | null {
  if (piece > 0) return 'red'
  if (piece < 0) return 'black'
  return null
}
export function pieceType(piece: number): number {
  return Math.abs(piece)
}

export function findGeneral(board: number[][], side: Side): [number, number] | null {
  const target = side === 'red' ? 1 : -1
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (board[r][c] === target) return [r, c]
  return null
}

function inPalace(r: number, c: number, side: Side): boolean {
  if (c < 3 || c > 5) return false
  if (side === 'red') return r >= 7 && r <= 9
  return r >= 0 && r <= 2
}

function crossedRiver(r: number, side: Side): boolean {
  // red crosses into rows 0-4; black into rows 5-9
  if (side === 'red') return r <= 4
  return r >= 5
}

export function pseudoMoves(board: number[][], side: Side): Move[] {
  const moves: Move[] = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (pieceSide(p) !== side) continue
      const t = pieceType(p)
      const add = (rr: number, cc: number) => {
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) return
        const target = board[rr][cc]
        if (pieceSide(target) === side) return
        moves.push({ from: [r, c], to: [rr, cc] })
      }
      switch (t) {
        case PIECE.GENERAL: {
          for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const rr = r + dr, cc = c + dc
            if (inPalace(rr, cc, side)) add(rr, cc)
          }
          break
        }
        case PIECE.ADVISOR: {
          for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
            const rr = r + dr, cc = c + dc
            if (inPalace(rr, cc, side)) add(rr, cc)
          }
          break
        }
        case PIECE.ELEPHANT: {
          for (const [dr, dc] of [[-2,-2],[-2,2],[2,-2],[2,2]]) {
            const rr = r + dr, cc = c + dc
            const mr = r + dr / 2, mc = c + dc / 2
            if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue
            // cannot cross river
            if (side === 'red' && rr < 5) continue
            if (side === 'black' && rr > 4) continue
            if (board[mr][mc] !== 0) continue
            add(rr, cc)
          }
          break
        }
        case PIECE.HORSE: {
          const deltas = [
            [-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[-1,2],[1,-2],[1,2],
          ]
          for (const [dr, dc] of deltas) {
            const rr = r + dr, cc = c + dc
            if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue
            // leg block
            let legR = r, legC = c
            if (Math.abs(dr) === 2) legR = r + (dr > 0 ? 1 : -1)
            else legC = c + (dc > 0 ? 1 : -1)
            if (board[legR][legC] !== 0) continue
            add(rr, cc)
          }
          break
        }
        case PIECE.CHARIOT: {
          for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            let rr = r + dr, cc = c + dc
            while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
              if (board[rr][cc] === 0) {
                moves.push({ from: [r, c], to: [rr, cc] })
              } else {
                if (pieceSide(board[rr][cc]) !== side) moves.push({ from: [r, c], to: [rr, cc] })
                break
              }
              rr += dr; cc += dc
            }
          }
          break
        }
        case PIECE.CANNON: {
          for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            let rr = r + dr, cc = c + dc
            // non-capture: slide until first piece
            while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc] === 0) {
              moves.push({ from: [r, c], to: [rr, cc] })
              rr += dr; cc += dc
            }
            // now at a piece (or off-board): skip it, then capture first enemy
            if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
              rr += dr; cc += dc
              while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
                if (board[rr][cc] !== 0) {
                  if (pieceSide(board[rr][cc]) !== side) moves.push({ from: [r, c], to: [rr, cc] })
                  break
                }
                rr += dr; cc += dc
              }
            }
          }
          break
        }
        case PIECE.SOLDIER: {
          const fwd = side === 'red' ? -1 : 1
          add(r + fwd, c)
          if (crossedRiver(r, side)) {
            add(r, c - 1)
            add(r, c + 1)
          }
          break
        }
      }
    }
  }
  return moves
}

function generalsFace(board: number[][]): boolean {
  const rg = findGeneral(board, 'red')
  const bg = findGeneral(board, 'black')
  if (!rg || !bg) return false
  if (rg[1] !== bg[1]) return false
  const c = rg[1]
  for (let r = Math.min(rg[0], bg[0]) + 1; r < Math.max(rg[0], bg[0]); r++) {
    if (board[r][c] !== 0) return false
  }
  return true
}

export function inCheck(board: number[][], side: Side): boolean {
  const g = findGeneral(board, side)
  if (!g) return true
  const opp: Side = side === 'red' ? 'black' : 'red'
  // flying general
  if (generalsFace(board)) return true
  // opponent pseudo moves targeting general
  const oppMoves = pseudoMoves(board, opp)
  for (const m of oppMoves) {
    if (m.to[0] === g[0] && m.to[1] === g[1]) return true
  }
  return false
}

export function applyMove(board: number[][], m: Move): number[][] {
  const nb = board.map((row) => row.slice())
  nb[m.to[0]][m.to[1]] = nb[m.from[0]][m.from[1]]
  nb[m.from[0]][m.from[1]] = 0
  return nb
}

export function legalMoves(board: number[][], side: Side): Move[] {
  const out: Move[] = []
  for (const m of pseudoMoves(board, side)) {
    const nb = applyMove(board, m)
    if (!inCheck(nb, side)) out.push(m)
  }
  // also flying general already handled by inCheck on resulting? Need ensure move doesn't leave generals facing.
  // inCheck covers flying general on resulting board.
  return out
}

export function isCheckmate(board: number[][], side: Side): boolean {
  return inCheck(board, side) && legalMoves(board, side).length === 0
}
export function isStalemate(board: number[][], side: Side): boolean {
  return !inCheck(board, side) && legalMoves(board, side).length === 0
}

export function colorOfPlayer(state: XiangqiState, userId: string): 1 | 2 | null {
  const p = state.players.find((pl) => pl.userId === userId)
  return p ? p.color : null
}

export function tryMove(state: XiangqiState, userId: string, fromR: number, fromC: number, toR: number, toC: number): XiangqiState | null {
  if (state.status !== 'playing') return null
  const color = colorOfPlayer(state, userId)
  if (color === null) return null
  const side = sideOfColor(color)
  if (sideOfColor(state.turn) !== side) return null
  if (state.turn !== color) return null
  // validate move
  const moves = legalMoves(state.board, side)
  const ok = moves.some((m) => m.from[0] === fromR && m.from[1] === fromC && m.to[0] === toR && m.to[1] === toC)
  if (!ok) return null
  const board = applyMove(state.board, { from: [fromR, fromC], to: [toR, toC] })
  const captured = state.board[toR][toC]
  const opp: Side = side === 'red' ? 'black' : 'red'
  let winnerId: string | null = null
  let status: XiangqiState['status'] = 'playing'
  // checkmate/stalemate
  if (isCheckmate(board, opp)) { winnerId = userId; status = 'result' }
  else if (isStalemate(board, opp)) { winnerId = userId; status = 'result' } // stalemate = win for mover in xiangqi
  // also if general captured (shouldn't happen with legal moves) handle:
  if (captured !== 0 && pieceType(captured) === PIECE.GENERAL) { winnerId = userId; status = 'result' }
  const scores = Object.fromEntries(state.players.map((pl) => [pl.userId, pl.score]))
  if (winnerId) scores[userId] = (scores[userId] ?? 0) + 1
  return {
    ...state,
    board,
    lastMove: { from: [fromR, fromC], to: [toR, toC] },
    winnerId,
    status,
    turn: status === 'result' ? state.turn : (state.turn === 1 ? 2 : 1),
    players: state.players.map((pl) => ({ ...pl, score: scores[pl.userId] ?? pl.score })),
  }
}

export function addAiOpponent(state: XiangqiState): XiangqiState | null {
  if (state.status !== 'waiting' || state.players.length !== 1 || state.players[0].isAI) return null
  const human = state.players[0]
  const ai: XiangqiPlayer = {
    userId: `xiangqi-ai:${state.instanceId}`,
    displayName: 'AI',
    avatarUrl: null,
    color: human.color === 1 ? 2 : 1,
    score: 0,
    joinedAt: Date.now(),
    isAI: true,
  }
  return {
    ...state,
    players: [...state.players, ai],
    turn: 1,
    status: 'playing',
  }
}

export function restartXiangqiRound(state: XiangqiState): XiangqiState {
  const round = state.round + (state.status === 'playing' || state.status === 'result' ? 1 : 0)
  return {
    ...state,
    board: initialBoard(),
    turn: 1,
    status: state.players.length === 2 ? 'playing' : 'waiting',
    winnerId: null,
    lastMove: null,
    round,
  }
}

export function removeXiangqiPlayer(state: XiangqiState, userId: string): XiangqiState | null {
  const leaving = state.players.find((player) => player.userId === userId && !player.isAI)
  if (!leaving) return null
  const players = state.players.some((player) => player.isAI) ? [] : state.players.filter((player) => player.userId !== userId)
  const round = players.length === 0 ? 1 : state.round + (state.status === 'playing' || state.status === 'result' ? 1 : 0)
  return {
    ...state,
    players,
    board: initialBoard(),
    turn: 1,
    status: players.length === 2 ? 'playing' : 'waiting',
    winnerId: null,
    lastMove: null,
    round,
  }
}

export function isXiangqiState(value: unknown, instanceId: string): value is XiangqiState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<XiangqiState>
  return state.instanceId === instanceId
    && typeof state.hostId === 'string'
    && Array.isArray(state.players)
    && Array.isArray(state.board)
    && state.board.length === ROWS
    && state.board.every((row) => Array.isArray(row) && row.length === COLS)
    && (state.status === 'waiting' || state.status === 'playing' || state.status === 'result')
}

export function emptyCellsCount(board: number[][]): number {
  let n = 0
  for (const row of board) for (const c of row) if (c === 0) n++
  return n
}