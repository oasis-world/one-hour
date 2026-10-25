import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { ChatEntry } from '../lib/chatTypes'

/**
 * Chat log scroll state machine (simplified from the oasis room hook):
 * keeps the newest line in view while the reader sits at the bottom, and
 * surfaces the jump-to-latest button once they scroll up. Programmatic
 * scrolls never count as user scrolls.
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

  // New entries only → keep the newest line in view when already at the
  // bottom; never yank a reader who scrolled up.
  const prevLenRef = useRef(entries.length)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const grew = entries.length > prevLenRef.current
    prevLenRef.current = entries.length
    if (grew && atBottomRef.current) scrollTo(el.scrollHeight)
  }, [entries, scrollRef, scrollTo])

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
