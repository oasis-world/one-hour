export const SUITS = ['♠', '♥', '♦', '♣'] as const
export type Suit = typeof SUITS[number]
export type Card = { id: string; rank: number; suit: Suit }
export type Hand = { cards: Card[]; bet: number; doubled: boolean; split: boolean; stood: boolean; payout: number }
export type Player = { userId: string; name: string; avatarUrl: string | null; avatarStyle?: string; avatarSeed?: string; bet: number; hands: Hand[] }
export type Phase = 'lobby' | 'players' | 'dealer' | 'result'
export type BlackjackState = {
  instanceId: string
  leaderId: string
  dealerId: string | 'ai' | null
  dealerName: string | null
  dealerAvatarUrl: string | null
  players: Player[]
  dealerHand: Card[]
  deck: Card[]
  phase: Phase
  activePlayer: number
  activeHand: number
  round: number
  results: Record<string, string>
}

export const MAX_PLAYERS = 4
export const BASE_BET = 10
const emptyHand = (): Hand => ({ cards: [], bet: BASE_BET, doubled: false, split: false, stood: false, payout: 0 })

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

export function createBlackjackState(instanceId: string, leaderId: string): BlackjackState {
  return { instanceId, leaderId, dealerId: null, dealerName: null, dealerAvatarUrl: null, players: [], dealerHand: [], deck: [], phase: 'lobby', activePlayer: 0, activeHand: 0, round: 0, results: {} }
}

function clearBlackjackTable(state: BlackjackState): BlackjackState {
  return { ...createBlackjackState(state.instanceId, state.leaderId), round: state.round }
}

export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = cards.reduce((sum, card) => sum + (card.rank === 1 ? 11 : Math.min(card.rank, 10)), 0)
  let aces = cards.filter((card) => card.rank === 1).length
  while (total > 21 && aces-- > 0) total -= 10
  return { total, soft: cards.some((card) => card.rank === 1) && total <= 21 && cards.reduce((sum, card) => sum + (card.rank === 1 ? 11 : Math.min(card.rank, 10)), 0) === total }
}

const isNatural = (hand: Hand) => !hand.split && hand.cards.length === 2 && handValue(hand.cards).total === 21
function finishRound(state: BlackjackState, dealerHand: Card[]): BlackjackState {
  const dealerScore = handValue(dealerHand).total
  const dealerNatural = dealerHand.length === 2 && dealerScore === 21
  const results: Record<string, string> = {}
  const players = state.players.map((player) => ({
    ...player,
    hands: player.hands.map((hand) => {
      const score = handValue(hand.cards).total
      const natural = isNatural(hand)
      const outcome = score > 21 ? 'bust' : dealerNatural ? (natural ? 'push' : 'lose') : natural ? 'blackjack' : dealerScore > 21 || score > dealerScore ? 'win' : score === dealerScore ? 'push' : 'lose'
      results[`${player.userId}:${player.hands.indexOf(hand)}`] = outcome
      const payout = outcome === 'blackjack' ? hand.bet * 2.5 : outcome === 'win' ? hand.bet * 2 : outcome === 'push' ? hand.bet : 0
      return { ...hand, stood: true, payout }
    }),
  }))
  return { ...state, players, dealerHand, phase: 'result', results }
}

function nextTurn(state: BlackjackState): BlackjackState {
  for (let p = state.activePlayer; p < state.players.length; p++) {
    const player = state.players[p]
    const firstHand = p === state.activePlayer ? state.activeHand + 1 : 0
    for (let h = firstHand; h < player.hands.length; h++) {
      if (!player.hands[h].stood && handValue(player.hands[h].cards).total < 21) return { ...state, activePlayer: p, activeHand: h }
    }
  }
  return { ...state, phase: 'dealer' }
}

export function joinBlackjack(state: BlackjackState, player: Omit<Player, 'hands'>): BlackjackState {
  if (state.phase !== 'lobby' || state.players.length >= MAX_PLAYERS || state.players.some((p) => p.userId === player.userId) || state.dealerId === player.userId) return state
  const bet = [1, 2, 5, 10, 20, 30].includes(player.bet) ? player.bet : BASE_BET
  return { ...state, players: [...state.players, { ...player, bet, hands: [{ ...emptyHand(), bet }] }] }
}

export function setBlackjackBet(state: BlackjackState, userId: string, bet: number): BlackjackState {
  if (state.phase !== 'lobby' || ![1, 2, 5, 10, 20, 30].includes(bet)) return state
  let changed = false
  const players = state.players.map((player) => {
    if (player.userId !== userId || player.bet === bet) return player
    changed = true
    return { ...player, bet, hands: [{ ...emptyHand(), bet }] }
  })
  return changed ? { ...state, players } : state
}

export function setBlackjackDealer(state: BlackjackState, dealerId: string | 'ai', dealerName?: string, avatarUrl?: string | null): BlackjackState {
  if (state.phase !== 'lobby' || (state.dealerId !== null && state.dealerId !== dealerId) || state.players.some((p) => p.userId === dealerId)) return state
  return { ...state, dealerId, dealerName: dealerId === 'ai' ? 'AI Dealer' : dealerName ?? 'Dealer', dealerAvatarUrl: dealerId === 'ai' ? null : avatarUrl ?? null }
}

export function leaveBlackjack(state: BlackjackState, userId: string): BlackjackState {
  if (state.dealerId === userId) {
    if (state.players.length === 0) return clearBlackjackTable(state)
    const keepAiDealer = state.phase === 'players' || state.phase === 'dealer'
    return { ...state, dealerId: keepAiDealer ? 'ai' : null, dealerName: keepAiDealer ? 'AI Dealer' : null, dealerAvatarUrl: null }
  }
  const playerIndex = state.players.findIndex((player) => player.userId === userId)
  if (playerIndex < 0) return state
  const players = state.players.filter((player) => player.userId !== userId)
  if (players.length === 0) return clearBlackjackTable(state)
  if (state.phase !== 'players') return { ...state, players }
  const activePlayer = playerIndex < state.activePlayer ? state.activePlayer - 1 : state.activePlayer
  if (playerIndex === state.activePlayer) {
    return nextTurn({ ...state, players, activePlayer, activeHand: -1 })
  }
  return { ...state, players, activePlayer }
}

export function startBlackjackRound(state: BlackjackState): BlackjackState {
  if (state.phase !== 'lobby' || !state.dealerId || !state.players.length) return state
  const deck = shuffledDeck()
  const players = state.players.map((player) => ({ ...player, hands: [{ ...emptyHand(), bet: player.bet }] }))
  const dealerHand: Card[] = []
  for (let deal = 0; deal < 2; deal++) {
    for (const player of players) player.hands[0].cards.push(deck.pop()!)
    dealerHand.push(deck.pop()!)
  }
  const initial: BlackjackState = { ...state, players, dealerHand, deck, phase: 'players', activePlayer: 0, activeHand: 0, round: state.round + 1, results: {} }
  if (handValue(dealerHand).total === 21) return finishRound(initial, dealerHand)
  for (let p = 0; p < players.length; p++) {
    if (isNatural(players[p].hands[0])) players[p].hands[0].stood = true
  }
  const firstActive = players.findIndex((player) => !player.hands[0].stood && handValue(player.hands[0].cards).total < 21)
  return firstActive < 0
    ? { ...initial, phase: 'dealer', activePlayer: players.length - 1 }
    : { ...initial, activePlayer: firstActive, activeHand: 0 }
}

export function applyPlayerAction(state: BlackjackState, userId: string, action: 'hit' | 'stand' | 'double'): BlackjackState {
  if (state.phase !== 'players' || state.players[state.activePlayer]?.userId !== userId) return state
  const nextPlayers = state.players.map((p) => ({ ...p, hands: p.hands.map((h) => ({ ...h, cards: [...h.cards] })) }))
  const current = nextPlayers[state.activePlayer].hands[state.activeHand]
  const deck = [...state.deck]
  if (action === 'hit' && handValue(current.cards).total < 21) {
    current.cards.push(deck.pop()!)
    if (handValue(current.cards).total >= 21) current.stood = true
  } else if (action === 'stand') current.stood = true
  else if (action === 'double' && current.cards.length === 2 && !current.doubled && handValue(current.cards).total < 21) {
    current.bet *= 2
    current.doubled = true
    return { ...state, players: nextPlayers }
  } else return state
  const next = nextTurn({ ...state, players: nextPlayers, deck })
  return next
}

export function finishHumanDealer(state: BlackjackState, userId: string): BlackjackState {
  if (state.phase !== 'dealer' || state.dealerId !== userId) return state
  const dealerHand = [...state.dealerHand]
  const deck = [...state.deck]
  while (handValue(dealerHand).total < 17) dealerHand.push(deck.pop()!)
  return finishRound({ ...state, deck }, dealerHand)
}

function finishAiDealer(state: BlackjackState): BlackjackState {
  const dealerHand = [...state.dealerHand]
  const deck = [...state.deck]
  while (handValue(dealerHand).total < 17) dealerHand.push(deck.pop()!)
  return finishRound({ ...state, deck }, dealerHand)
}

export function finishBlackjackAi(state: BlackjackState): BlackjackState {
  if (state.phase !== 'dealer' || state.dealerId !== 'ai') return state
  return finishAiDealer(state)
}

export function resetBlackjackRound(state: BlackjackState): BlackjackState {
  if (state.phase !== 'result') return state
  return { ...state, phase: 'lobby', dealerHand: [], deck: [], activePlayer: 0, activeHand: 0, results: {}, players: state.players.map((p) => ({ ...p, hands: [{ ...emptyHand(), bet: p.bet }] })) }
}

export function cardLabel(card: Card): string {
  return card.rank === 1 ? 'A' : card.rank === 11 ? 'J' : card.rank === 12 ? 'Q' : card.rank === 13 ? 'K' : String(card.rank)
}
