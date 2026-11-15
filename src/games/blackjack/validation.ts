import { MAX_PLAYERS, SUITS, type BlackjackState, type Card, type Hand, type Player } from './model'

export function isBlackjackState(value: unknown, instanceId: string): value is BlackjackState {
  if (!value || typeof value !== 'object') return false
  const state = value as BlackjackState
  const validCard = (card: unknown): card is Card => Boolean(card && typeof card === 'object'
    && typeof (card as Card).id === 'string' && Number.isInteger((card as Card).rank)
    && (card as Card).rank >= 1 && (card as Card).rank <= 13 && SUITS.includes((card as Card).suit))
  const validHand = (hand: unknown) => Boolean(hand && typeof hand === 'object'
    && Array.isArray((hand as Hand).cards) && (hand as Hand).cards.every(validCard)
    && typeof (hand as Hand).bet === 'number' && typeof (hand as Hand).stood === 'boolean')
  const validPlayer = (player: unknown) => Boolean(player && typeof player === 'object'
    && typeof (player as Player).userId === 'string' && typeof (player as Player).name === 'string'
    && Number.isFinite((player as Player).bet)
    && Array.isArray((player as Player).hands) && (player as Player).hands.length > 0
    && (player as Player).hands.length <= 4 && (player as Player).hands.every(validHand))
  return state.instanceId === instanceId && typeof state.leaderId === 'string'
    && (state.dealerId === null || state.dealerId === 'ai' || typeof state.dealerId === 'string')
    && Array.isArray(state.players) && state.players.length <= MAX_PLAYERS && state.players.every(validPlayer)
    && Array.isArray(state.dealerHand) && state.dealerHand.every(validCard)
    && Array.isArray(state.deck) && state.deck.every(validCard)
    && Number.isInteger(state.activePlayer) && Number.isInteger(state.activeHand)
    && ['lobby', 'players', 'dealer', 'result'].includes(state.phase)
}
