export const SYMBOLS = ['cherry', 'lemon', 'orange', 'grapes', 'bell', 'star', 'diamond', 'wild'] as const
export type SymbolId = typeof SYMBOLS[number]
export type ReelGrid = SymbolId[][]

export const PAYLINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
] as const

// Keep common fruit frequencies close enough that every fruit can hit regularly.
// These weights and payouts together target about 98% theoretical return for this
// free-play demo; this is a design target, not certified casino RTP.
const WEIGHTS: SymbolId[] = [
  ...Array<SymbolId>(8).fill('cherry'), ...Array<SymbolId>(3).fill('lemon'),
  ...Array<SymbolId>(3).fill('orange'), ...Array<SymbolId>(3).fill('grapes'),
  ...Array<SymbolId>(2).fill('bell'), 'star', 'diamond', ...Array<SymbolId>(2).fill('wild'),
]
export const PAYOUTS: Record<SymbolId, readonly [number, number, number]> = {
  cherry: [3, 10, 26], lemon: [3, 7, 20], orange: [3, 8, 23], grapes: [4, 10, 31],
  bell: [5, 16, 52], star: [7, 21, 65], diamond: [13, 39, 130], wild: [21, 78, 260],
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
    const symbols: SymbolId[] = [...new Set(lineSymbols)].filter((value) => value !== 'wild')
    if (symbols.length === 0) symbols.push('wild')
    let best: SlotWin | null = null

    for (const symbol of symbols) {
      let reel = 0
      while (reel < lineSymbols.length) {
        const matches = (value: SymbolId) => symbol === 'wild' ? value === 'wild' : value === symbol || value === 'wild'
        while (reel < lineSymbols.length && !matches(lineSymbols[reel])) reel += 1
        const start = reel
        while (reel < lineSymbols.length && matches(lineSymbols[reel])) reel += 1
        const count = reel - start
        if (count < 3) continue

        const amount = Math.round(lineBet * PAYOUTS[symbol][count - 3])
        const candidate: SlotWin = {
          symbol,
          count,
          amount,
          cells: line.slice(start, reel).map((row, offset) => (start + offset) * 3 + row),
        }
        if (!best || candidate.count > best.count || (candidate.count === best.count && candidate.amount > best.amount)) {
          best = candidate
        }
      }
    }

    if (best) wins.push(best)
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
