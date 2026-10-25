import { useEffect, useRef } from 'react'
/**
 * Desktop hover-to-reveal for the corner popovers: hovering the trigger
 * area opens after a beat, leaving schedules a hide with a grace period
 * long enough to cross the gap between the icon and the popover body
 * (both live inside the same hover container). `enabled` is false on
 * touch devices — callers keep their click-to-toggle behavior.
 */

const OPEN_DELAY_MS = 140
const CLOSE_GRACE_MS = 360

export function useHoverReveal(
  enabled: boolean,
  reveal: () => void,
  hide: () => void,
): {
  onEnter: () => void
  onLeave: () => void
} {
  // Keep the latest callbacks without resetting pending timers.
  const revealRef = useRef(reveal)
  const hideRef = useRef(hide)
  useEffect(() => {
    revealRef.current = reveal
    hideRef.current = hide
  })

  const openTimer = useRef<number | null>(null)
  const closeTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (openTimer.current) window.clearTimeout(openTimer.current)
      if (closeTimer.current) window.clearTimeout(closeTimer.current)
    },
    [],
  )

  const onEnter = () => {
    if (!enabled) return
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    if (openTimer.current) return
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null
      revealRef.current()
    }, OPEN_DELAY_MS)
  }

  const onLeave = () => {
    if (!enabled) return
    if (openTimer.current) {
      window.clearTimeout(openTimer.current)
      openTimer.current = null
    }
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null
      hideRef.current()
    }, CLOSE_GRACE_MS)
  }

  return { onEnter, onLeave }
}
