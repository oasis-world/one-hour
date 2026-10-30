export const BOARD_SIZE = 11
export type Stone = 0 | 1 | 2 // 0 empty, 1 black, 2 white

export interface GomokuPlayer {
  userId: string
  displayName: string
  avatarUrl: string | null
  color: 1 | 2
  score: number
  joinedAt: number
  isAI?: boolean
}

export interface GomokuState {
  instanceId: string
  hostId: string
  players: GomokuPlayer[]
  board: Stone[][]
  turn: 1 | 2
  status: 'waiting' | 'playing' | 'result'
  winnerId: string | null
  winningLine: [number, number][] | null
  lastMove: { r: number; c: number } | null
  round: number
}

export function emptyBoard(): Stone[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0) as Stone[])
}

export function createInitialState(instanceId: string, hostId: string): GomokuState {
  return {
    instanceId,
    hostId,
    players: [],
    board: emptyBoard(),
    turn: 1,
    status: 'waiting',
    winnerId: null,
    winningLine: null,
    lastMove: null,
    round: 1,
  }
}

export function addAiOpponent(state: GomokuState): GomokuState | null {
  if (state.status !== 'waiting' || state.players.length !== 1 || state.players[0].isAI) return null
  const human = state.players[0]
  const ai: GomokuPlayer = {
    userId: `gomoku-ai:${state.instanceId}`,
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
    turn: state.round % 2 === 1 ? 1 : 2,
    status: 'playing',
  }
}

export function restartGomokuRound(state: GomokuState): GomokuState {
  const round = state.round + (state.status === 'playing' || state.status === 'result' ? 1 : 0)
  return {
    ...state,
    board: emptyBoard(),
    turn: round % 2 === 1 ? 1 : 2,
    status: state.players.length === 2 ? 'playing' : 'waiting',
    winnerId: null,
    winningLine: null,
    lastMove: null,
    round,
  }
}

export function removeGomokuPlayer(state: GomokuState, userId: string): GomokuState | null {
  const leaving = state.players.find((player) => player.userId === userId && !player.isAI)
  if (!leaving) return null
  // An AI belongs to its human's solo session; don't leave an orphan AI in the room.
  const players = state.players.some((player) => player.isAI)
    ? []
    : state.players.filter((player) => player.userId !== userId)
  return {
    ...state,
    players,
    status: players.length === 2 ? 'playing' : 'waiting',
  }
}

export function isGomokuState(value: unknown, instanceId: string): value is GomokuState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<GomokuState>
  return state.instanceId === instanceId
    && typeof state.hostId === 'string'
    && Array.isArray(state.players)
    && Array.isArray(state.board)
    && state.board.length === BOARD_SIZE
    && state.board.every((row) => Array.isArray(row) && row.length === BOARD_SIZE)
    && (state.status === 'waiting' || state.status === 'playing' || state.status === 'result')
}

export function findWinLine(board: Stone[][], r: number, c: number, color: Stone): [number, number][] | null {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const
  for (const [dr, dc] of dirs) {
    const line: [number, number][] = [[r, c]]
    // forward
    let rr = r + dr
    let cc = c + dc
    while (rr >= 0 && rr < BOARD_SIZE && cc >= 0 && cc < BOARD_SIZE && board[rr][cc] === color) {
      line.push([rr, cc])
      rr += dr
      cc += dc
    }
    // backward
    rr = r - dr
    cc = c - dc
    while (rr >= 0 && rr < BOARD_SIZE && cc >= 0 && cc < BOARD_SIZE && board[rr][cc] === color) {
      line.unshift([rr, cc])
      rr -= dr
      cc -= dc
    }
    if (line.length >= 5) return line
  }
  return null
}

export function isBoardFull(board: Stone[][]): boolean {
  return board.every((row) => row.every((cell) => cell !== 0))
}

export function colorOfPlayer(state: GomokuState, userId: string): 1 | 2 | null {
  const p = state.players.find((pl) => pl.userId === userId)
  return p ? p.color : null
}

export function tryMove(state: GomokuState, userId: string, r: number, c: number): GomokuState | null {
  if (state.status !== 'playing') return null
  const color = colorOfPlayer(state, userId)
  if (color === null || color !== state.turn) return null
  if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return null
  if (state.board[r][c] !== 0) return null
  const board = state.board.map((row) => row.slice())
  board[r][c] = color
  const line = findWinLine(board, r, c, color)
  const scores: Record<string, number> = Object.fromEntries(state.players.map((pl) => [pl.userId, pl.score]))
  let winnerId: string | null = null
  if (line) {
    winnerId = userId
    scores[userId] = (scores[userId] ?? 0) + 1
  }
  const draw = !line && isBoardFull(board)
  return {
    ...state,
    board,
    lastMove: { r, c },
    winningLine: line,
    winnerId,
    status: line || draw ? 'result' : 'playing',
    turn: line || draw ? state.turn : (state.turn === 1 ? 2 : 1),
    players: state.players.map((pl) => ({ ...pl, score: scores[pl.userId] ?? pl.score })),
  }
}
