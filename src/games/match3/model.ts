export const BOARD_SIZE = 8
export const TILE_TYPES = 7
const DIRECTIONS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

export type Board = number[][]

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice())
}

export function findMatches(board: Board): Set<string> {
  const size = board.length
  const matched = new Set<string>()
  // horizontal
  for (let r = 0; r < size; r++) {
    let c = 0
    while (c < size) {
      if (board[r][c] === -1) { c++; continue }
      let run = 1
      while (c + run < size && board[r][c + run] === board[r][c]) run++
      if (run >= 3) {
        for (let k = 0; k < run; k++) matched.add(`${r},${c + k}`)
      }
      c += run > 1 ? run : 1
    }
  }
  // vertical
  for (let c = 0; c < size; c++) {
    let r = 0
    while (r < size) {
      if (board[r][c] === -1) { r++; continue }
      let run = 1
      while (r + run < size && board[r + run][c] === board[r][c]) run++
      if (run >= 3) {
        for (let k = 0; k < run; k++) matched.add(`${r + k},${c}`)
      }
      r += run > 1 ? run : 1
    }
  }
  return matched
}

export function collapseBoard(board: Board, typeCount: number): Board {
  const size = board.length
  const next = cloneBoard(board)
  for (let c = 0; c < size; c++) {
    let write = size - 1
    for (let r = size - 1; r >= 0; r--) {
      if (next[r][c] !== -1) {
        next[write][c] = next[r][c]
        if (write !== r) next[r][c] = -1
        write--
      }
    }
    for (let r = write; r >= 0; r--) {
      next[r][c] = Math.floor(Math.random() * typeCount)
    }
  }
  return next
}

export function removeMatches(board: Board, matches: Set<string>): Board {
  const next = cloneBoard(board)
  for (const key of matches) {
    const [r, c] = key.split(',').map(Number)
    next[r][c] = -1
  }
  return next
}

export function adjacent(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1
}

export function trySwap(board: Board, a: [number, number], b: [number, number]): Board | null {
  if (!adjacent(a, b)) return null
  const next = cloneBoard(board)
  const tmp = next[a[0]][a[1]]
  next[a[0]][a[1]] = next[b[0]][b[1]]
  next[b[0]][b[1]] = tmp
  if (findMatches(next).size === 0) return null
  return next
}

export function hasAnyMove(board: Board): boolean {
  const size = board.length
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      for (const [dr, dc] of DIRECTIONS) {
        const nr = r + dr, nc = c + dc
        if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue
        const next = cloneBoard(board)
        const tmp = next[r][c]
        next[r][c] = next[nr][nc]
        next[nr][nc] = tmp
        if (findMatches(next).size > 0) return true
      }
    }
  }
  return false
}

function createMatchFreeBoard(typeCount: number, size: number, seedMove = false): Board {
  const board: Board = Array.from({ length: size }, () => Array<number>(size).fill(-1))
  if (seedMove && typeCount >= 3 && size >= 3) {
    board[0].splice(0, 3, 1, 0, 2)
    board[1].splice(0, 3, 1, 2, 0)
    board[2].splice(0, 3, 2, 1, 2)
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] !== -1) continue
      const options = Array.from({ length: typeCount }, (_, tile) => tile).filter((tile) =>
        !(c >= 2 && board[r][c - 1] === tile && board[r][c - 2] === tile) &&
        !(r >= 2 && board[r - 1][c] === tile && board[r - 2][c] === tile),
      )
      board[r][c] = options[Math.floor(Math.random() * options.length)]
    }
  }
  return board
}

export function randomBoard(typeCount: number, size: number = BOARD_SIZE): Board {
  let board: Board
  for (let attempt = 0; attempt < 100; attempt++) {
    board = createMatchFreeBoard(typeCount, size)
    if (hasAnyMove(board)) return board
  }
  board = createMatchFreeBoard(typeCount, size, true)
  return board
}

export function shuffleBoard(_board: Board, typeCount: number): Board {
  return randomBoard(typeCount)
}
