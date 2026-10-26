import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { ChatEntry } from '../lib/chatTypes'

/**
 * Chat log scroll state machine (simplified from the oasis room hook):
 * a new message always brings the reader down to the newest line —
 * gliding when it means traveling from older history, snapping when
 * already close. Programmatic scrolls never count as user scrolls.
 */
export function useChatScroll(opts: {
  scrollRef: RefObject<HTMLDivElement | null>
  entries: ChatEntry[]
  /** Layout flip (fold/unfold) resizes the log. */
  layoutKey: boolean
}) {
  const { scrollRef, entries, layoutKey } = opts
  const [showJumpEnd, setShowJumpEnd] = useState(false)
  const atBottomRef = useRef(true)
  const programmaticRef = useRef(false)

  const scrollTo = useCallback(
    (top: number, smooth = false) => {
      const el = scrollRef.current
      if (!el) return
      programmaticRef.current = true
      if (smooth) el.scrollTo({ top, behavior: 'smooth' })
      else el.scrollTop = top
      requestAnimationFrame(() => {
        programmaticRef.current = false
      })
    },
    [scrollRef],
  )

  const scrollToEnd = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    atBottomRef.current = true
    setShowJumpEnd(false)
    scrollTo(el.scrollHeight)
  }, [scrollRef, scrollTo])

  const jumpToEnd = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    atBottomRef.current = true
    setShowJumpEnd(false)
    scrollTo(el.scrollHeight, true)
  }, [scrollRef, scrollTo])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || programmaticRef.current) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    atBottomRef.current = distFromBottom <= 56
    setShowJumpEnd(distFromBottom > 56)
  }, [scrollRef])

  // New entries only → always ride down to the newest line: a quick snap
  // when the reader is near the bottom, a glide when it means traveling
  // back from older history.
  const prevLenRef = useRef(entries.length)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const grew = entries.length > prevLenRef.current
    prevLenRef.current = entries.length
    if (!grew) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distFromBottom > 240) jumpToEnd()
    else scrollToEnd()
  }, [entries, scrollRef, scrollTo, jumpToEnd, scrollToEnd])

  // Container resize (keyboard, fold/unfold) must not strand a
  // bottom-anchored reader above the newest line.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (atBottomRef.current) scrollTo(el.scrollHeight)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [scrollRef, scrollTo])

  // Layout flip: keep the reader where they were unless at the bottom.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || atBottomRef.current) return
    scrollTo(el.scrollTop)
  }, [layoutKey, scrollRef, scrollTo])

  return { showJumpEnd, scrollToEnd, jumpToEnd, handleScroll }
}
