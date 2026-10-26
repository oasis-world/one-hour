import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { ChatEntry } from '../lib/chatTypes'

/**
 * Chat log scroll state machine (simplified from the oasis room hook):
 * The reader stays pinned only while already at the bottom; otherwise new
 * messages accumulate behind the jump-to-latest affordance.
 */
export function useChatScroll(opts: {
  scrollRef: RefObject<HTMLDivElement | null>
  entries: ChatEntry[]
  incomingMessageSequence: number
  /** Layout flip (fold/unfold) resizes the log. */
  layoutKey: boolean
}) {
  const { scrollRef, entries, incomingMessageSequence, layoutKey } = opts
  const [showJumpEnd, setShowJumpEnd] = useState(false)
  const [newMessageCount, setNewMessageCount] = useState(0)
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
    setNewMessageCount(0)
    scrollTo(el.scrollHeight)
  }, [scrollRef, scrollTo])

  const jumpToEnd = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    atBottomRef.current = true
    setShowJumpEnd(false)
    setNewMessageCount(0)
    scrollTo(el.scrollHeight, true)
  }, [scrollRef, scrollTo])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || programmaticRef.current) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    atBottomRef.current = distFromBottom <= 56
    setShowJumpEnd(distFromBottom > 56)
    if (atBottomRef.current) setNewMessageCount(0)
  }, [scrollRef])

  // Keep the bottom reader pinned. Never yank someone away from history.
  const previousNewestIdRef = useRef(entries[entries.length - 1]?.id)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const newestId = entries[entries.length - 1]?.id
    const newestChanged = newestId != null && newestId !== previousNewestIdRef.current
    previousNewestIdRef.current = newestId
    if (!newestChanged) return
    if (atBottomRef.current) scrollToEnd()
    else setShowJumpEnd(true)
  }, [entries, scrollRef, scrollToEnd])

  // This sequence is raised only for new Realtime messages from other users;
  // history prepends, cache restores, and the player's own sends don't count.
  const seenIncomingRef = useRef(incomingMessageSequence)
  useEffect(() => {
    const unseen = incomingMessageSequence - seenIncomingRef.current
    seenIncomingRef.current = incomingMessageSequence
    if (unseen <= 0 || atBottomRef.current) return
    setNewMessageCount((count) => count + unseen)
    setShowJumpEnd(true)
  }, [incomingMessageSequence])

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

  /**
   * Content grew without new entries (chat photos decoding in after the
   * send-time scroll already ran): stay pinned only if the reader was
   * already at the bottom — never yank someone browsing history.
   */
  const stickToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el || !atBottomRef.current) return
    scrollTo(el.scrollHeight)
  }, [scrollRef, scrollTo])

  return { showJumpEnd, newMessageCount, scrollToEnd, jumpToEnd, handleScroll, stickToBottom }
}
