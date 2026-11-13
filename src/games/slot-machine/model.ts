export const SYMBOLS = ['cherry', 'lemon', 'orange', 'grapes', 'bell', 'star', 'diamond', 'wild'] as const
export type SymbolId = typeof SYMBOLS[number]
export type ReelGrid = SymbolId[][]

export const PAYLINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
] as const

// Symbol frequencies and paytable are tuned together for about 97% theoretical
// return in this free-play demo; this is a design target, not certified casino RTP.
const WEIGHTS: SymbolId[] = [
  ...Array<SymbolId>(13).fill('cherry'), 'lemon', 'lemon', 'orange', 'orange',
  'grapes', 'grapes', 'bell', 'bell', 'star', 'diamond', 'wild',
]
export const PAYOUTS: Record<SymbolId, readonly [number, number, number]> = {
  cherry: [1, 4, 10], lemon: [1, 2.5, 7.5], orange: [1.2, 3, 9], grapes: [1.5, 4, 12],
  bell: [2, 6, 20], star: [2.5, 8, 25], diamond: [5, 15, 50], wild: [8, 30, 100],
}

export function randomSymbol(): SymbolId {
  return WEIGHTS[Math.floor(Math.random() * WEIGHTS.length)]
}

export function randomGrid(): ReelGrid {
  return Array.from({ length: 5 }, () => Array.from({ length: 3 }, randomSymbol))
}

export interface SlotWin { symbol: SymbolId; count: number; amount: number; cells: number[] }
export interface SlotScore { payout: number; wins: SlotWin[] }

export function scoreGrid(grid: ReelGrid, lineBet: number): SlotScore {
  const wins: SlotWin[] = []
  PAYLINES.forEach((line) => {
    const lineSymbols = line.map((row, reel) => grid[reel][row])
    const symbol = lineSymbols.find((value) => value !== 'wild') ?? 'wild'
    let count = 0
    for (let reel = 0; reel < 5; reel += 1) {
      const landed = grid[reel][line[reel]]
      if (landed !== symbol && landed !== 'wild') break
      count += 1
    }
    if (count >= 3) {
      const amount = Math.round(lineBet * PAYOUTS[symbol][count - 3])
      wins.push({ symbol, count, amount, cells: line.slice(0, count).map((row, reel) => reel * 3 + row) })
    }
  })
  return { payout: wins.reduce((sum, win) => sum + win.amount, 0), wins }
}

export interface SlotSave { bet: number; spins: number; bestWin: number }
export const DEFAULT_SAVE: SlotSave = { bet: 1, spins: 0, bestWin: 0 }

export function readSave(key: string): SlotSave {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (value && typeof value === 'object') {
      const save = value as Partial<SlotSave>
      if (Number.isFinite(save.bet) && Number.isFinite(save.spins) && Number.isFinite(save.bestWin)) {
        return { bet: [1, 2, 5, 10, 20].includes(save.bet!) ? save.bet! : 1, spins: Math.max(0, save.spins!), bestWin: Math.max(0, save.bestWin!) }
      }
    }
  } catch { /* Storage may be unavailable. */ }
  return { ...DEFAULT_SAVE }
}
