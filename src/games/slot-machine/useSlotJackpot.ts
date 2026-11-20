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
import { sendSysNotice } from '../../lib/sysNotice'
import { flashStarPointsDelta } from '../../lib/starPoints'
import { MESSAGE_TTL_MS } from '../../lib/expiry'

const EMPTY: SlotJackpotState = { pool: 0, version: 0, drawAt: null, lastPayout: null }

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
 * Shared prize pool for one slot card. Contributions are atomic RPC calls and
 * the first one into an empty pool stamps a shared `draw_at` deadline (now +
 * 5 min). Every player on the board watches that deadline and races to pay out
 * when it arrives: a row lock + idempotency key ensure exactly one pays and
 * posts the single public notice. This keeps the draw — and its countdown —
 * running even after the card's sender has expired out of the room.
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
    // Pick up the shared draw deadline the server stamped for this new round.
    void readSlotJackpot(instanceId).then((fresh) => {
      if (fresh && stateRef.current.version <= fresh.version) {
        const merged = { ...fresh, pool: Math.max(fresh.pool, pool) }
        stateRef.current = merged
        setState(merged)
      }
    })
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
      sendSysNotice((lang) => buildSlotJackpotNotice(winners, total, lang), Date.now() + MESSAGE_TTL_MS)
    } finally {
      payingRef.current = false
    }
  }, [instanceId])

  useEffect(() => {
    if (!canPayout || !state.drawAt || state.pool <= 0) return
    // Fire at the shared deadline. Small jitter spreads simultaneous tabs; the
    // RPC row lock still guarantees only one actually pays and announces.
    const delay = Math.max(0, state.drawAt - Date.now()) + Math.floor(Math.random() * 800)
    const fire = window.setTimeout(() => { void runPayout() }, delay)
    // Safety net: if a single timer is missed or the RPC fails once, keep
    // retrying until the pool is paid (a payout resets pool → 0 for everyone).
    const retry = window.setInterval(() => {
      if (state.drawAt && state.drawAt <= Date.now()) void runPayout()
    }, 10_000)
    return () => {
      window.clearTimeout(fire)
      window.clearInterval(retry)
    }
  }, [canPayout, state.drawAt, state.pool, runPayout])

  return { state, gainFlash, payoutFlash, contribute }
}
