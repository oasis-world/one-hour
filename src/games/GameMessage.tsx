import { useLayoutEffect, useRef, useState } from 'react'
import { parseGameRef } from './types'
import { getGameById } from './registry'
import type { PresenceMember } from '../lib/chatTypes'
import './GameMessage.css'

const GAME_VISIBILITY_MARGIN = 360

interface Props {
  content: string
  hostUserId: string
  onlineMembers?: PresenceMember[]
  /** On a fresh load the latest row is immediately scrolled into view. */
  initiallyVisible?: boolean
}

export default function GameMessage({ content, hostUserId, onlineMembers = [], initiallyVisible = false }: Props) {
  const [isInView, setIsInView] = useState(initiallyVisible)
  const elementRef = useRef<HTMLDivElement>(null)
  const gameRef = parseGameRef(content)
  const instanceId = gameRef?.instanceId

  useLayoutEffect(() => {
    const element = elementRef.current
    if (!instanceId || !element) return
    const root = element.closest('.chat-log')
    const column = element.closest('.chat-column')
    let frame = 0
    let lastHeight = element.getBoundingClientRect().height
    let lastBottom = element.getBoundingClientRect().bottom
    const settleTimers: number[] = []
    const measureVisibility = () => {
      frame = 0
      // A background tab is not evidence that this game left the viewport.
      // Keep mounted games (and their live state) intact while the page is
      // hidden; visibility is measured again as soon as it becomes active.
      if (document.hidden) return
      const bounds = element.getBoundingClientRect()
      const rootBounds = root?.getBoundingClientRect()
      const left = Math.max(bounds.left, rootBounds?.left ?? 0, 0)
      const right = Math.min(bounds.right, rootBounds?.right ?? window.innerWidth, window.innerWidth)
      // Match the observer's pre-mount margin. Using the unexpanded viewport
      // here immediately unmounted cards that were just mounted 120px early.
      const rootTop = rootBounds ? Math.max(0, rootBounds.top - GAME_VISIBILITY_MARGIN) : -GAME_VISIBILITY_MARGIN
      const rootBottom = rootBounds ? Math.min(window.innerHeight, rootBounds.bottom + GAME_VISIBILITY_MARGIN) : window.innerHeight + GAME_VISIBILITY_MARGIN
      const top = Math.max(bounds.top, rootTop)
      const bottom = Math.min(bounds.bottom, rootBottom)
      const visible = right > left && bottom > top
      setIsInView((current) => current === visible ? current : visible)
    }
    const scheduleMeasure = () => {
      if (frame) return
      frame = window.requestAnimationFrame(measureVisibility)
    }
    const observer = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(([entry]) => {
          if (document.hidden) return
          if (entry?.isIntersecting) setIsInView(true)
          else scheduleMeasure()
        }, { root, rootMargin: `${GAME_VISIBILITY_MARGIN}px 0px`, threshold: 0 })
    observer?.observe(element)
    root?.addEventListener('scroll', scheduleMeasure, { passive: true })
    window.addEventListener('resize', scheduleMeasure)
    window.addEventListener('orientationchange', scheduleMeasure)
    const measureOnReturn = () => {
      if (document.hidden) return
      measureVisibility()
      scheduleMeasure()
    }
    const measureAfterUnfold = (event: Event) => {
      if ((event as AnimationEvent).animationName !== 'fold-back') return
      // The chat column enters the viewport through a transform animation.
      // ResizeObserver does not report transforms, so explicitly remeasure
      // while it unfolds and once the final geometry has settled.
      for (const delay of [120, 280, 540]) {
        settleTimers.push(window.setTimeout(scheduleMeasure, delay))
      }
    }
    const measureAfterAnimation = () => scheduleMeasure()
    column?.addEventListener('animationstart', measureAfterUnfold)
    column?.addEventListener('animationend', measureAfterAnimation)
    window.addEventListener('pageshow', measureOnReturn)
    document.addEventListener('visibilitychange', measureOnReturn)
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', scheduleMeasure)
    viewport?.addEventListener('scroll', scheduleMeasure)
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver((entries) => {
      const entry = entries.find((item) => item.target === element)
      if (entry) {
        const bounds = element.getBoundingClientRect()
        const rootBounds = root?.getBoundingClientRect()
        const nextHeight = bounds.height
        const heightDelta = nextHeight - lastHeight
        let scrollAdjustment = 0
        // Keep the reader's scroll position stable when a prefetched card
        // above the viewport swaps its placeholder for the real game.
        if (root && rootBounds && lastBottom <= rootBounds.top && Math.abs(heightDelta) > 0.5) {
          scrollAdjustment = heightDelta
          root.scrollTop += heightDelta
        }
        lastHeight = nextHeight
        lastBottom = bounds.bottom - scrollAdjustment
      }
      scheduleMeasure()
    })
    resizeObserver?.observe(element)
    if (root) resizeObserver?.observe(root)
    // Measure before paint so an already-visible game never flashes the
    // empty placeholder while waiting for IntersectionObserver's first tick.
    measureVisibility()
    scheduleMeasure()
    // Mobile browsers can restore scroll position after the first layout and
    // after passive effects run. Recheck as that restoration settles so a
    // visible game doesn't remain stuck on its placeholder after refresh.
    for (const delay of [80, 240, 700, 1400]) {
      settleTimers.push(window.setTimeout(scheduleMeasure, delay))
    }
    return () => {
      observer?.disconnect()
      resizeObserver?.disconnect()
      root?.removeEventListener('scroll', scheduleMeasure)
      column?.removeEventListener('animationstart', measureAfterUnfold)
      column?.removeEventListener('animationend', measureAfterAnimation)
      window.removeEventListener('resize', scheduleMeasure)
      window.removeEventListener('orientationchange', scheduleMeasure)
      window.removeEventListener('pageshow', measureOnReturn)
      document.removeEventListener('visibilitychange', measureOnReturn)
      viewport?.removeEventListener('resize', scheduleMeasure)
      viewport?.removeEventListener('scroll', scheduleMeasure)
      if (frame) window.cancelAnimationFrame(frame)
      for (const timer of settleTimers) window.clearTimeout(timer)
    }
  }, [instanceId])

  if (!gameRef) return null
  const def = getGameById(gameRef.type)
  if (!def) return null
  const Component = def.Component
  // The newest row is bottom-anchored on a fresh load. Mount its game
  // immediately instead of waiting for an observer callback that may race
  // scroll restoration on desktop and mobile browsers alike.
  const active = initiallyVisible || typeof IntersectionObserver === 'undefined' || isInView
  return (
    <div ref={elementRef} className="game-message-inview">
      {active
        ? <Component instanceId={gameRef.instanceId} hostUserId={hostUserId} onlineMembers={onlineMembers} />
        : <div className="game-message-placeholder" aria-hidden="true" />}
    </div>
  )
}
