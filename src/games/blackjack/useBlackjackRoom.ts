import { useCallback, useState } from 'react'
import { useAccount } from '../../lib/useAccount'
import { resolveChatIdentity } from '../../lib/identity'
import { loadUserProfile } from '../../lib/userProfile'
import {
  advanceToDealer, applyPlayerAction, createBlackjackGame, finishBlackjackDealer, leaveBlackjackTable,
  rematchBlackjackRound, startBlackjackRound, type BlackjackState,
} from './model'

/**
 * Pure local single-player room: every game card owns its own table state,
 * so each viewer plays an independent round against the AI dealer. There is
 * no networking, no shared presence and no cross-tab interference.
 */
export function useBlackjackRoom(instanceId: string) {
  const account = useAccount()
  const identity = resolveChatIdentity(account)
  const profile = loadUserProfile()
  const selfId = identity?.userId ?? null
  const displayName = identity?.displayName ?? profile?.nickname ?? 'Player'
  const avatarUrl = identity?.avatarUrl ?? null
  const avatarStyle = identity?.avatar?.style
  const avatarSeed = identity?.avatar?.seed
  const [state, setState] = useState<BlackjackState>(() => createBlackjackGame(instanceId))

  const play = useCallback((bet: number) => {
    if (!selfId) return
    setState((current) => startBlackjackRound(current, { userId: selfId, name: displayName, avatarUrl, avatarStyle, avatarSeed, bet }))
  }, [selfId, displayName, avatarUrl, avatarStyle, avatarSeed])

  const act = useCallback((action: 'hit' | 'stand' | 'double') => {
    setState((current) => applyPlayerAction(current, action))
  }, [])

  const advance = useCallback(() => {
    setState((current) => advanceToDealer(current))
  }, [])

  const finishDealer = useCallback(() => {
    setState((current) => finishBlackjackDealer(current))
  }, [])

  const rematch = useCallback((bet: number) => {
    setState((current) => rematchBlackjackRound(current, bet))
  }, [])

  const leave = useCallback(() => {
    setState((current) => leaveBlackjackTable(current))
  }, [])

  return { state, selfId, play, act, advance, finishDealer, rematch, leave }
}
