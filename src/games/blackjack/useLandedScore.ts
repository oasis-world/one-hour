import { useEffect, useRef, useState } from 'react'
import { BJ_DEAL_MS, handValue, type Card as PlayingCard } from './model'

/**
 * Fresh deal: the score pill stays completely hidden until the cards land,
 * then it appears with the total. Card added mid-hand: keeps showing the
 * previous total and flips to the new one on landing — no hide/show flicker.
 * Result badges key off `landed`.
 *
 * Completion is tracked per card signature (`settledRef`), never inferred
 * from intermediate refs. That way an effect re-run whose timer was cleared
 * (StrictMode double-invoke, HMR remount) always re-arms instead of bailing
 * out and stranding the pill hidden forever.
 */
export function useLandedScore(cards: PlayingCard[], lastStaggerMs: number) {
  const [shown, setShown] = useState<{ total: number; soft: boolean } | null>(null)
  const [landed, setLanded] = useState(false)
  const sigRef = useRef('')
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
      finish(value)
      return
    }
    const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      finish(value)
      return
    }
    if (freshDeal) setShown(null)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLanded(false)
    const timer = window.setTimeout(() => finish(value), lastStaggerMs + BJ_DEAL_MS)
    return () => window.clearTimeout(timer)
  }, [cards, lastStaggerMs])
  return { shown, landed }
}
