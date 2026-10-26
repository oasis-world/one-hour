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
