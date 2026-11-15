import { useEffect, useRef, useState } from 'react'
import { BJ_DEAL_MS, handValue, type Card as PlayingCard } from './model'

/**
 * Fresh deal: the score stays completely hidden until the cards land, then it
 * appears with the total. Card added mid-hand: keeps showing the previous
 * total and flips to the new one on landing — no hide/show flicker.
 */
export function useLandedScore(cards: PlayingCard[], lastStaggerMs: number) {
  const [shown, setShown] = useState<{ total: number; soft: boolean } | null>(null)
  const [landed, setLanded] = useState(false)
  const lenRef = useRef(0)
  const sigRef = useRef('')
  // Signatures whose landing has fully completed (value shown + flag set).
  // Unlike bailing on "nothing changed", this survives effect re-runs
  // (StrictMode double-invoke, HMR) without stranding a cleared timer.
  const settledRef = useRef<string | null>(null)
  useEffect(() => {
    const sig = cards.map((card) => card.id).join(',')
    if (settledRef.current === sig) return
    const prevIds = sigRef.current ? new Set(sigRef.current.split(',')) : null
    const freshDeal = Boolean(prevIds && sig !== sigRef.current && !cards.some((card) => prevIds.has(card.id)))
    sigRef.current = sig
    const value = handValue(cards)
    const finish = (next: typeof value) => {
      settledRef.current = sig
      setShown(next)
      setLanded(true)
    }
    if (cards.length === 0) {
      lenRef.current = 0
      finish(value)
      return
    }
    if (freshDeal) {
      lenRef.current = cards.length
      const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) {
        finish(value)
        return
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(null)
      setLanded(false)
      const timer = window.setTimeout(() => finish(value), lastStaggerMs + BJ_DEAL_MS)
      return () => window.clearTimeout(timer)
    }
    if (cards.length > lenRef.current) {
      lenRef.current = cards.length
      const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) {
        finish(value)
        return
      }
      setLanded(false)
      const timer = window.setTimeout(() => finish(value), lastStaggerMs + BJ_DEAL_MS)
      return () => window.clearTimeout(timer)
    }
    lenRef.current = cards.length
    finish(value)
  }, [cards, lastStaggerMs])
  return { shown, landed }
}
