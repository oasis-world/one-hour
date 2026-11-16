import { useCallback, useEffect, useRef, useState } from 'react'
import type { SlotLeaderboardPlayer } from './useSlotLeaderboard'
import {
  contributeToSlotJackpot,
  payoutSlotJackpot,
  readSlotJackpot,
  subscribeSlotJackpot,
  type SlotJackpotRecipient,
  type SlotJackpotState,
} from '../../lib/slotJackpot'
import { buildSlotJackpotNotice } from '../../lib/slotJackpotNotice'
import { sendGameNotice } from '../../lib/gameNotice'
import { flashStarPointsDelta } from '../../lib/starPoints'
import { MESSAGE_TTL_MS } from '../../lib/expiry'

const PAYOUT_INTERVAL_MS = 5 * 60 * 1000
const EMPTY: SlotJackpotState = { pool: 0, version: 0, lastPayout: null }

export interface SlotJackpotView {
  state: SlotJackpotState
  /** Increments when the pool grows — drives the "+N" coin pop animation. */
  gainFlash: number
  /** Increments on a payout — drives the celebration glow. */
  payoutFlash: number
  /** Resolves true when the pool accepted the contribution. */
  contribute: (amount: number, spinNumber: number, userId: string) => Promise<boolean>
}

/** Split the whole pool into random positive-ish shares that sum exactly to it. */
function randomSplit(pool: number, count: number): number[] {
  const weights = Array.from({ length: count }, () => 0.5 + Math.random())
  const sum = weights.reduce((total, weight) => total + weight, 0)
  const shares = weights.map((weight) => Math.floor((pool * weight) / sum))
  let leftover = pool - shares.reduce((total, share) => total + share, 0)
  while (leftover > 0) {
    shares[Math.floor(Math.random() * count)] += 1
    leftover -= 1
  }
  return shares
}

/**
 * Shared prize pool for one slot card. Contributions are atomic RPC calls.
 * Every player on the board runs the five-minute payout check: the RPC takes a
 * row lock and an idempotency key, so whichever client gets there first pays
 * out and posts the single public notice; the rest see an empty pool and do
 * nothing. That way the draw keeps running even after the card's sender has
 * expired out of the room. All clients watch the same table for the balance.
 */
export function useSlotJackpot(
  instanceId: string,
  canPayout: boolean,
  players: SlotLeaderboardPlayer[],
  currentUserId: string | null,
): SlotJackpotView {
  const [state, setState] = useState<SlotJackpotState>({ ...EMPTY })
  const [gainFlash, setGainFlash] = useState(0)
  const [payoutFlash, setPayoutFlash] = useState(0)
  const stateRef = useRef(state)
  const playersRef = useRef(players)
  const payingRef = useRef(false)

  useEffect(() => {
    playersRef.current = players
  }, [players])

  useEffect(() => {
    let received = false
    const stop = subscribeSlotJackpot(instanceId, (next) => {
      received = true
      const prev = stateRef.current
      if (next.pool > prev.pool) setGainFlash((value) => value + 1)
      if (next.lastPayout && next.lastPayout.payoutId !== prev.lastPayout?.payoutId) {
        setPayoutFlash((value) => value + 1)
        const mine = currentUserId
          ? next.lastPayout.recipients.find((recipient) => recipient.userId === currentUserId)
          : undefined
        if (mine) flashStarPointsDelta(mine.amount)
      }
      stateRef.current = next
      setState(next)
    })
    void readSlotJackpot(instanceId).then((initial) => {
      if (initial && !received) {
        stateRef.current = initial
        setState(initial)
      }
    })
    return stop
  }, [instanceId, currentUserId])

  const contribute = useCallback(async (amount: number, spinNumber: number, userId: string): Promise<boolean> => {
    if (amount <= 0 || !userId) return false
    const contributionId = `${instanceId}:${userId}:${spinNumber}`
    const pool = await contributeToSlotJackpot(instanceId, contributionId, amount)
    if (pool == null) return false
    const next = { ...stateRef.current, pool }
    stateRef.current = next
    setState(next)
    return true
  }, [instanceId])

  const runPayout = useCallback(async () => {
    if (payingRef.current) return
    // Read the authoritative pool: a client that joined late (or missed a
    // realtime event) must not skip a draw just because its cache says zero.
    const fresh = await readSlotJackpot(instanceId)
    const pool = fresh?.pool ?? stateRef.current.pool
    if (pool <= 0) return
    const board = playersRef.current
    if (board.length === 0) return
    payingRef.current = true
    try {
      const shares = randomSplit(pool, board.length)
      const winners: Array<SlotJackpotRecipient & { name: string }> = []
      board.forEach((player, index) => {
        if (shares[index] > 0) winners.push({ userId: player.userId, name: player.name, amount: shares[index] })
      })
      if (winners.length === 0) return
      const payoutId = `${instanceId}:${Date.now()}:${Math.floor(Math.random() * 1_000_000)}`
      const result = await payoutSlotJackpot(
        instanceId,
        payoutId,
        winners.map(({ userId, amount }) => ({ userId, amount })),
      )
      if (!result?.paid) return
      const total = result.total ?? winners.reduce((sum, winner) => sum + winner.amount, 0)
      sendGameNotice(buildSlotJackpotNotice(winners, total), Date.now() + MESSAGE_TTL_MS)
    } finally {
      payingRef.current = false
    }
  }, [instanceId])

  useEffect(() => {
    if (!canPayout) return
    // A little jitter spreads simultaneous draws from many open tabs; the RPC
    // lock still guarantees exactly one of them actually pays and announces.
    const jitter = Math.floor(Math.random() * 2500)
    const timer = window.setInterval(() => { void runPayout() }, PAYOUT_INTERVAL_MS + jitter)
    return () => window.clearInterval(timer)
  }, [canPayout, runPayout])

  return { state, gainFlash, payoutFlash, contribute }
}
