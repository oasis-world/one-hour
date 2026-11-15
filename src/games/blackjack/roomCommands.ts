import {
  applyPlayerAction, finishBlackjackAi, finishHumanDealer, joinBlackjack, leaveBlackjack,
  resetBlackjackRound, setBlackjackBet, setBlackjackDealer, startBlackjackRound,
  type BlackjackState, type Player,
} from './model'

export type Command =
  | { type: 'join'; player: Omit<Player, 'hands'> }
  | { type: 'dealer'; dealerId: string | 'ai'; name?: string; avatarUrl?: string | null }
  | { type: 'quick-play'; player: Omit<Player, 'hands'> }
  | { type: 'set-bet'; userId: string; bet: number }
  | { type: 'start' }
  | { type: 'action'; userId: string; action: 'hit' | 'stand' | 'double' }
  | { type: 'finish-dealer'; userId: string }
  | { type: 'finish-ai' }
  | { type: 'rematch' }
  | { type: 'leave'; userId: string }

export function reduceBlackjackCommand(state: BlackjackState, command: Command): BlackjackState {
  if (command.type === 'join') return joinBlackjack(state, command.player)
  if (command.type === 'dealer') return setBlackjackDealer(state, command.dealerId, command.name, command.avatarUrl)
  if (command.type === 'quick-play') return startBlackjackRound(joinBlackjack(setBlackjackDealer(state, 'ai'), command.player))
  if (command.type === 'set-bet') return setBlackjackBet(state, command.userId, command.bet)
  if (command.type === 'start') return startBlackjackRound(state)
  if (command.type === 'action') return applyPlayerAction(state, command.userId, command.action)
  if (command.type === 'finish-dealer') return finishHumanDealer(state, command.userId)
  if (command.type === 'finish-ai') return finishBlackjackAi(state)
  if (command.type === 'rematch') return resetBlackjackRound(state)
  return leaveBlackjack(state, command.userId)
}
