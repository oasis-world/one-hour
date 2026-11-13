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

export function randomBoard(typeCount: number, size: number = BOARD_SIZE): Board {
  let board: Board = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => Math.floor(Math.random() * typeCount))
  )
  // remove initial matches
  let changed = true
  let guard = 0
  while (changed && guard < 50) {
    changed = false
    guard++
    const matches = findMatches(board)
    if (matches.size) {
      for (const key of matches) {
        const [r, c] = key.split(',').map(Number)
        board[r][c] = Math.floor(Math.random() * typeCount)
        changed = true
      }
    }
  }
  // ensure at least one move
  if (!hasAnyMove(board)) {
    // shuffle all cells
    const flat = board.flat()
    for (let i = flat.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = flat[i]; flat[i] = flat[j]; flat[j] = tmp
    }
    board = []
    for (let r = 0; r < size; r++) board.push(flat.slice(r * size, (r + 1) * size))
    // remove matches again
    changed = true; guard = 0
    while (changed && guard < 50) {
      changed = false; guard++
      const matches = findMatches(board)
      if (matches.size) {
        for (const key of matches) {
          const [r, c] = key.split(',').map(Number)
          board[r][c] = Math.floor(Math.random() * typeCount)
          changed = true
        }
      }
    }
  }
  return board
}

export function shuffleBoard(_board: Board, typeCount: number): Board {
  return randomBoard(typeCount)
}
