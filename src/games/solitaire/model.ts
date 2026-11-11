export const SUITS = ['♠', '♥', '♣', '♦'] as const
export type Suit = typeof SUITS[number]
export type Card = { id: string; rank: number; suit: Suit; faceUp: boolean }
export type Pile = Card[]
export type Position = { stock: Card[]; waste: Card[]; tableau: Pile[]; foundations: Pile[]; score: number; moves: number }
export type SolitaireState = Position & { drawCount: 1 | 3; startedAt: number; won: boolean; past: Position[] }
export type Source = { zone: 'waste' | 'tableau' | 'foundation'; index: number }

export const rankLabel = (rank: number) => rank === 1 ? 'A' : rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : String(rank)
export const isRed = (suit: Suit) => suit === '♥' || suit === '♦'

function shuffledDeck(): Card[] {
  const deck = SUITS.flatMap((suit) => Array.from({ length: 13 }, (_, i) => ({
    id: `${suit}-${i + 1}`, rank: i + 1, suit, faceUp: false,
  })))
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

export function newGame(drawCount: 1 | 3 = 1): SolitaireState {
  const deck = shuffledDeck()
  const tableau = Array.from({ length: 7 }, (_, column) =>
    Array.from({ length: column + 1 }, (_, row) => ({ ...deck.pop()!, faceUp: row === column })),
  )
  return { stock: deck, waste: [], tableau, foundations: [[], [], [], []], drawCount, score: 0, moves: 0, startedAt: Date.now(), won: false, past: [] }
}

const position = (s: SolitaireState): Position => ({
  stock: s.stock, waste: s.waste, tableau: s.tableau, foundations: s.foundations, score: s.score, moves: s.moves,
})

function commit(state: SolitaireState, next: Position, won = false): SolitaireState {
  return { ...state, ...next, past: [...state.past.slice(-199), position(state)], won, moves: state.moves + 1 }
}

export function drawCards(state: SolitaireState): SolitaireState {
  if (!state.stock.length) {
    if (!state.waste.length) return state
    const stock = [...state.waste].reverse().map((card) => ({ ...card, faceUp: false }))
    return commit(state, { ...position(state), stock, waste: [], score: state.score, moves: state.moves })
  }
  const stock = [...state.stock]
  const waste = [...state.waste]
  for (let i = 0; i < state.drawCount && stock.length; i++) waste.push({ ...stock.pop()!, faceUp: true })
  return commit(state, { ...position(state), stock, waste, score: state.score, moves: state.moves })
}

export function undo(state: SolitaireState): SolitaireState {
  const previous = state.past.at(-1)
  if (!previous) return state
  return { ...state, ...previous, past: state.past.slice(0, -1), won: false }
}

export function topCard(state: SolitaireState, source: Source): Card | undefined {
  if (source.zone === 'waste') return state.waste.at(-1)
  if (source.zone === 'foundation') return state.foundations[source.index]?.at(-1)
  return state.tableau[source.index]?.at(-1)
}

function take(state: SolitaireState, source: Source, tableauStart?: number): { cards: Card[]; tableau: Pile[]; waste: Card[]; foundations: Pile[] } | null {
  const tableau = state.tableau.map((pile) => [...pile])
  const waste = [...state.waste]
  const foundations = state.foundations.map((pile) => [...pile])
  if (source.zone === 'waste' && waste.length) return { cards: [waste.pop()!], tableau, waste, foundations }
  if (source.zone === 'foundation' && foundations[source.index]?.length) return { cards: [foundations[source.index].pop()!], tableau, waste, foundations }
  if (source.zone === 'tableau') {
    const pile = tableau[source.index]
    const start = tableauStart ?? (pile?.length ?? 0) - 1
    if (pile?.[start]?.faceUp) return { cards: pile.splice(start), tableau, waste, foundations }
  }
  return null
}

export function canMoveToTableau(cards: Card[], target: Card | undefined): boolean {
  if (!cards.length) return false
  const first = cards[0]
  return target ? target.rank === first.rank + 1 && isRed(target.suit) !== isRed(first.suit) : first.rank === 13
}

export function moveToTableau(state: SolitaireState, source: Source, column: number, startIndex?: number): SolitaireState {
  if (source.zone === 'tableau' && source.index === column) return state
  const first = source.zone === 'tableau' && startIndex !== undefined
    ? state.tableau[source.index]?.[startIndex]
    : topCard(state, source)
  if (!first) return state
  const cards = source.zone === 'tableau' && startIndex !== undefined
    ? state.tableau[source.index].slice(startIndex)
    : [first]
  const targetPile = state.tableau[column]
  if (!canMoveToTableau(cards, targetPile.at(-1))) return state
  const taken = take(state, source, source.zone === 'tableau' ? startIndex : undefined)
  if (!taken) return state
  taken.tableau[column].push(...cards.map((card) => ({ ...card, faceUp: true })))
  let score = state.score
  if (source.zone === 'tableau' && taken.tableau[source.index].length && !taken.tableau[source.index].at(-1)!.faceUp) {
    taken.tableau[source.index][taken.tableau[source.index].length - 1] = { ...taken.tableau[source.index].at(-1)!, faceUp: true }
    score += 5
  }
  if (source.zone === 'foundation') score = Math.max(0, score - 15)
  if (source.zone === 'waste') score += 5
  return commit(state, { stock: state.stock, waste: taken.waste, tableau: taken.tableau, foundations: taken.foundations, score, moves: state.moves }, false)
}

export function moveToFoundation(state: SolitaireState, source: Source, foundation: number): SolitaireState {
  const card = topCard(state, source)
  if (!card || source.zone === 'foundation') return state
  const target = state.foundations[foundation]
  if (target.length ? target.at(-1)!.suit !== card.suit || target.at(-1)!.rank + 1 !== card.rank : card.rank !== 1) return state
  const taken = take(state, source)
  if (!taken) return state
  taken.foundations[foundation].push({ ...card, faceUp: true })
  if (source.zone === 'tableau' && taken.tableau[source.index].length && !taken.tableau[source.index].at(-1)!.faceUp) {
    taken.tableau[source.index][taken.tableau[source.index].length - 1] = { ...taken.tableau[source.index].at(-1)!, faceUp: true }
  }
  const flipped = source.zone === 'tableau' && taken.tableau[source.index].length > 0
    && !state.tableau[source.index].at(-2)?.faceUp
  const score = state.score + 10 + (flipped ? 5 : 0)
  const won = taken.foundations.every((pile) => pile.length === 13)
  return commit(state, { stock: state.stock, waste: taken.waste, tableau: taken.tableau, foundations: taken.foundations, score, moves: state.moves }, won)
}

export function autoFoundation(state: SolitaireState, excludedCardId?: string): SolitaireState {
  let next = state
  let changed = true
  while (changed && !next.won) {
    changed = false
    const sources: Source[] = [
      ...(next.waste.length ? [{ zone: 'waste' as const, index: 0 }] : []),
      ...next.tableau.map((_, index) => ({ zone: 'tableau' as const, index })),
    ]
    for (const source of sources) {
      const card = topCard(next, source)
      if (!card || card.id === excludedCardId) continue
      const target = next.foundations.findIndex((pile) => pile.length ? pile.at(-1)!.suit === card.suit && pile.at(-1)!.rank + 1 === card.rank : card.rank === 1)
      if (target >= 0) { next = moveToFoundation(next, source, target); changed = true; break }
    }
  }
  return next
}

export function getHint(state: SolitaireState): string {
  if (state.tableau.some((pile) => pile.length > 1 && !pile.at(-2)!.faceUp)) return 'flip'
  if (state.tableau.some((pile) => pile.length && pile.at(-1)!.rank === 13) && state.tableau.some((pile) => pile.length === 0)) return 'king'
  if (state.waste.length || state.tableau.some((pile) => pile.length)) return 'move'
  return 'draw'
}
