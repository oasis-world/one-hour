import { useEffect, useRef, useState } from 'react'
import type { SlotBalanceFlash, SlotLeaderboardPlayer } from './useSlotLeaderboard'

/** Brief +/− pop animation when a player's per-card score changes. */
export function useSlotScoreFlashes(players: SlotLeaderboardPlayer[]): Record<string, SlotBalanceFlash> {
  const [flashes, setFlashes] = useState<Record<string, SlotBalanceFlash>>({})
  const prevScores = useRef<Record<string, number>>({})
  const flashSeq = useRef(0)

  useEffect(() => {
    const current: Record<string, number> = {}
    const next: Record<string, SlotBalanceFlash> = {}
    for (const player of players) {
      current[player.userId] = player.score
      const previous = prevScores.current[player.userId]
      if (previous !== undefined && previous !== player.score) {
        flashSeq.current += 1
        next[player.userId] = { id: flashSeq.current, delta: player.score - previous }
      }
    }
    prevScores.current = current
    if (Object.keys(next).length === 0) return
    // Defer so the flash lands outside the effect body.
    const timer = window.setTimeout(() => setFlashes((old) => ({ ...old, ...next })), 0)
    return () => window.clearTimeout(timer)
  }, [players])

  useEffect(() => {
    if (Object.keys(flashes).length === 0) return
    const timer = window.setTimeout(() => setFlashes({}), 1300)
    return () => window.clearTimeout(timer)
  }, [flashes])

  return flashes
}
