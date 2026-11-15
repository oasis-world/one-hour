export const SUITS = ['♠', '♥', '♦', '♣'] as const
export type Suit = typeof SUITS[number]
export type Card = { id: string; rank: number; suit: Suit }
export type Hand = { cards: Card[]; bet: number; doubled: boolean; stood: boolean; payout: number }
export type Player = { userId: string; name: string; avatarUrl: string | null; avatarStyle?: string; avatarSeed?: string; bet: number; hands: Hand[] }
export type Phase = 'lobby' | 'players' | 'dealer' | 'result'
export type BlackjackState = {
  instanceId: string
  players: Player[]
  dealerHand: Card[]
  deck: Card[]
  phase: Phase
  round: number
  results: Record<string, string>
}

export const BASE_BET = 1
/** Deal animation duration — must match `.bj-card-stack` animation in CSS. */
export const BJ_DEAL_MS = 700
const BETS = [1, 2, 5, 10, 20, 30]
const emptyHand = (bet: number): Hand => ({ cards: [], bet, doubled: false, stood: false, payout: 0 })

function shuffledDeck(): Card[] {
  const deck = SUITS.flatMap((suit) => Array.from({ length: 13 }, (_, index) => ({
    id: `${suit}-${index + 1}-${Math.random().toString(36).slice(2, 6)}`, suit, rank: index + 1,
  })))
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

export function createBlackjackGame(instanceId: string): BlackjackState {
  return { instanceId, players: [], dealerHand: [], deck: [], phase: 'lobby', round: 0, results: {} }
}

function clearBlackjackTable(state: BlackjackState): BlackjackState {
  return { ...createBlackjackGame(state.instanceId), round: state.round }
}

export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = cards.reduce((sum, card) => sum + (card.rank === 1 ? 11 : Math.min(card.rank, 10)), 0)
  let aces = cards.filter((card) => card.rank === 1).length
  while (total > 21 && aces-- > 0) total -= 10
  return { total, soft: cards.some((card) => card.rank === 1) && total <= 21 && cards.reduce((sum, card) => sum + (card.rank === 1 ? 11 : Math.min(card.rank, 10)), 0) === total }
}

const isNatural = (hand: Hand) => hand.cards.length === 2 && handValue(hand.cards).total === 21
function finishRound(state: BlackjackState, dealerHand: Card[]): BlackjackState {
  const dealerScore = handValue(dealerHand).total
  const dealerNatural = dealerHand.length === 2 && dealerScore === 21
  const results: Record<string, string> = {}
  const players = state.players.map((player) => ({
    ...player,
    hands: player.hands.map((hand, handIndex) => {
      const score = handValue(hand.cards).total
      const natural = isNatural(hand)
      const outcome = score > 21 ? 'bust' : dealerNatural ? (natural ? 'push' : 'lose') : natural ? 'blackjack' : dealerScore > 21 || score > dealerScore ? 'win' : score === dealerScore ? 'push' : 'lose'
      results[`${player.userId}:${handIndex}`] = outcome
      // Blackjack pays 3:2 — round half up so points stay whole everywhere.
      const payout = outcome === 'blackjack' ? Math.round(hand.bet * 2.5) : outcome === 'win' ? hand.bet * 2 : outcome === 'push' ? hand.bet : 0
      return { ...hand, stood: true, payout }
    }),
  }))
  return { ...state, players, dealerHand, phase: 'result', results }
}

export function startBlackjackRound(state: BlackjackState, player: Omit<Player, 'hands'>): BlackjackState {
  if (state.phase !== 'lobby' || state.players.length > 0) return state
  const bet = BETS.includes(player.bet) ? player.bet : BASE_BET
  const deck = shuffledDeck()
  const hands = [{ ...emptyHand(bet) }]
  const dealerHand: Card[] = []
  for (let deal = 0; deal < 2; deal++) {
    hands[0].cards.push(deck.pop()!)
    dealerHand.push(deck.pop()!)
  }
  const players = [{ ...player, bet, hands }]
  const initial: BlackjackState = { ...state, players, dealerHand, deck, phase: 'players', round: state.round + 1, results: {} }
  if (handValue(dealerHand).total === 21) return finishRound(initial, dealerHand)
  // A natural stands at once, but the table still waits for the dealt cards
  // to land before handing the turn to the dealer (see advanceToDealer).
  if (isNatural(hands[0])) players[0].hands[0].stood = true
  return initial
}

export function applyPlayerAction(state: BlackjackState, action: 'hit' | 'stand' | 'double'): BlackjackState {
  if (state.phase !== 'players' || state.players.length === 0) return state
  const nextPlayers = state.players.map((p) => ({ ...p, hands: p.hands.map((h) => ({ ...h, cards: [...h.cards] })) }))
  const current = nextPlayers[0].hands[0]
  const deck = [...state.deck]
  if (action === 'hit' && handValue(current.cards).total < 21) {
    current.cards.push(deck.pop()!)
    // The hand keeps the turn until its last card has landed; the table
    // hands over to the dealer afterwards (see advanceToDealer).
    if (handValue(current.cards).total < 21) return { ...state, players: nextPlayers, deck }
    current.stood = true
    return { ...state, players: nextPlayers, deck }
  } else if (action === 'stand' && !current.stood) {
    current.stood = true
    // No new card: nothing left to wait for, hand over immediately.
    return { ...state, players: nextPlayers, deck, phase: 'dealer' }
  } else if (action === 'double' && current.cards.length === 2 && !current.doubled && handValue(current.cards).total < 21) {
    current.bet *= 2
    current.doubled = true
    current.cards.push(deck.pop()!)
    current.stood = true
    return { ...state, players: nextPlayers, deck }
  } else return state
}

/** Hand the turn to the dealer once every hand has stood and landed. */
export function advanceToDealer(state: BlackjackState): BlackjackState {
  if (state.phase !== 'players' || state.players.length === 0) return state
  if (!state.players.every((player) => player.hands.every((hand) => hand.stood))) return state
  return { ...state, phase: 'dealer' }
}

function finishAiDealer(state: BlackjackState): BlackjackState {
  const dealerHand = [...state.dealerHand]
  const deck = [...state.deck]
  while (handValue(dealerHand).total < 17) dealerHand.push(deck.pop()!)
  return finishRound({ ...state, deck }, dealerHand)
}

export function finishBlackjackDealer(state: BlackjackState): BlackjackState {
  if (state.phase !== 'dealer') return state
  return finishAiDealer(state)
}

export function rematchBlackjackRound(state: BlackjackState, bet: number): BlackjackState {
  if (state.phase !== 'result') return state
  const player = state.players[0]
  if (!player) return clearBlackjackTable(state)
  const entry = BETS.includes(bet) ? { ...player, bet } : player
  return startBlackjackRound({ ...clearBlackjackTable(state), phase: 'lobby' }, entry)
}

export function leaveBlackjackTable(state: BlackjackState): BlackjackState {
  return clearBlackjackTable(state)
}

export function cardLabel(card: Card): string {
  return card.rank === 1 ? 'A' : card.rank === 11 ? 'J' : card.rank === 12 ? 'Q' : card.rank === 13 ? 'K' : String(card.rank)
}
