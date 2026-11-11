export type Difficulty = 'easy' | 'medium' | 'hard'
export type SudokuSnapshot = { values: number[]; notes: number[][] }
export type SudokuState = {
  puzzle: number[]
  solution: number[]
  values: number[]
  notes: number[][]
  difficulty: Difficulty
  startedAt: number
  mistakes: number
  hints: number
  complete: boolean
  history: SudokuSnapshot[]
}

const REMOVALS: Record<Difficulty, number> = { easy: 36, medium: 45, hard: 52 }
const blankNotes = () => Array.from({ length: 81 }, () => [] as number[])
const shuffled = (items: number[]) => [...items].sort(() => Math.random() - .5)

function candidates(grid: number[], index: number) {
  const row = Math.floor(index / 9)
  const column = index % 9
  const used = new Set<number>()
  for (let i = 0; i < 9; i++) {
    used.add(grid[row * 9 + i])
    used.add(grid[i * 9 + column])
  }
  const boxRow = Math.floor(row / 3) * 3
  const boxColumn = Math.floor(column / 3) * 3
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxColumn; c < boxColumn + 3; c++) used.add(grid[r * 9 + c])
  }
  return Array.from({ length: 9 }, (_, i) => i + 1).filter((value) => !used.has(value))
}

function solve(grid: number[], limit: number, randomize: boolean) {
  let solutions = 0
  const search = (): boolean => {
    let best = -1
    let choices: number[] = []
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue
      const options = candidates(grid, i)
      if (!options.length) return false
      if (best < 0 || options.length < choices.length) {
        best = i
        choices = options
        if (options.length === 1) break
      }
    }
    if (best < 0) { solutions++; return solutions >= limit }
    if (randomize) choices = shuffled(choices)
    for (const value of choices) {
      grid[best] = value
      if (search()) { if (!randomize) grid[best] = 0; return true }
    }
    grid[best] = 0
    return false
  }
  search()
  return solutions
}

export function createSudoku(difficulty: Difficulty): SudokuState {
  const solution = Array<number>(81).fill(0)
  solve(solution, 1, true)
  const puzzle = [...solution]
  let removed = 0
  for (const index of shuffled(Array.from({ length: 81 }, (_, i) => i))) {
    if (removed >= REMOVALS[difficulty]) break
    const value = puzzle[index]
    puzzle[index] = 0
    if (solve([...puzzle], 2, false) === 1) removed++
    else puzzle[index] = value
  }
  return {
    puzzle, solution, values: [...puzzle], notes: blankNotes(), difficulty,
    startedAt: Date.now(), mistakes: 0, hints: 0, complete: false, history: [],
  }
}

export function isSudokuState(value: unknown): value is SudokuState {
  if (!value || typeof value !== 'object') return false
  const state = value as SudokuState
  return Array.isArray(state.puzzle) && state.puzzle.length === 81
    && Array.isArray(state.solution) && state.solution.length === 81
    && Array.isArray(state.values) && state.values.length === 81
    && Array.isArray(state.notes) && state.notes.length === 81
    && ['easy', 'medium', 'hard'].includes(state.difficulty)
    && Number.isFinite(state.startedAt)
}

export function isSolved(values: number[], solution: number[]) {
  return values.every((value, index) => value === solution[index])
}

export function getConflicts(values: number[]) {
  const conflicts = new Set<number>()
  const checkGroup = (indices: number[]) => {
    const byValue = new Map<number, number[]>()
    for (const index of indices) {
      const value = values[index]
      if (!value) continue
      byValue.set(value, [...(byValue.get(value) ?? []), index])
    }
    byValue.forEach((cells) => { if (cells.length > 1) cells.forEach((cell) => conflicts.add(cell)) })
  }
  for (let i = 0; i < 9; i++) {
    checkGroup(Array.from({ length: 9 }, (_, n) => i * 9 + n))
    checkGroup(Array.from({ length: 9 }, (_, n) => n * 9 + i))
    const row = Math.floor(i / 3) * 3
    const column = (i % 3) * 3
    checkGroup(Array.from({ length: 9 }, (_, n) => (row + Math.floor(n / 3)) * 9 + column + n % 3))
  }
  return conflicts
}
