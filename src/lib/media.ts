import { useEffect, useState } from 'react'

/**
 * Reactive narrow-viewport flag (phones), kept in sync with the CSS
 * breakpoint at 820px — the same width where the chat column goes
 * full-screen and the top bar collapses into its toggle chip.
 */
export function useViewportNarrow(maxWidthPx = 820): boolean {
  const [narrow, setNarrow] = useState(() => {
    try {
      return window.innerWidth <= maxWidthPx
    } catch {
      return false
    }
  })

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`)
    const onChange = () => setNarrow(mq.matches)
    onChange()
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [maxWidthPx])

  return narrow
}

/**
 * Reactive "real hover" flag: a fine pointer that can hover (desktop
 * mouse). Gate hover-to-open popovers on it — touch devices keep the
 * click-to-toggle behavior.
 */
export function useHoverCapable(): boolean {
  const [capable, setCapable] = useState(() => {
    try {
      return window.matchMedia('(hover: hover) and (pointer: fine)').matches
    } catch {
      return false
    }
  })

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const onChange = () => setCapable(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  return capable
}
