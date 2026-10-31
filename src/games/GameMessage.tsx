import { useEffect, useRef, useState } from 'react'
import { parseGameRef } from './types'
import { getGameById } from './registry'
import type { PresenceMember } from '../lib/chatTypes'
import './GameMessage.css'

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

  useEffect(() => {
    const element = elementRef.current
    if (!instanceId || !element) return
    const root = element.closest('.chat-log')
    let frame = 0
    const settleTimers: number[] = []
    const measureVisibility = () => {
      frame = 0
      if (document.hidden) {
        setIsInView(false)
        return
      }
      const bounds = element.getBoundingClientRect()
      const rootBounds = root?.getBoundingClientRect()
      const left = Math.max(bounds.left, rootBounds?.left ?? 0, 0)
      const right = Math.min(bounds.right, rootBounds?.right ?? window.innerWidth, window.innerWidth)
      const top = Math.max(bounds.top, rootBounds?.top ?? 0, 0)
      const bottom = Math.min(bounds.bottom, rootBounds?.bottom ?? window.innerHeight, window.innerHeight)
      setIsInView(right > left && bottom > top)
    }
    const scheduleMeasure = () => {
      if (frame) return
      frame = window.requestAnimationFrame(measureVisibility)
    }
    const observer = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(([entry]) => {
          setIsInView(Boolean(entry?.isIntersecting))
          if (!entry?.isIntersecting) scheduleMeasure()
        }, { root, threshold: 0 })
    observer?.observe(element)
    root?.addEventListener('scroll', scheduleMeasure, { passive: true })
    window.addEventListener('resize', scheduleMeasure)
    window.addEventListener('orientationchange', scheduleMeasure)
    window.addEventListener('pageshow', scheduleMeasure)
    document.addEventListener('visibilitychange', scheduleMeasure)
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', scheduleMeasure)
    viewport?.addEventListener('scroll', scheduleMeasure)
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure)
    resizeObserver?.observe(element)
    if (root) resizeObserver?.observe(root)
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
      window.removeEventListener('resize', scheduleMeasure)
      window.removeEventListener('orientationchange', scheduleMeasure)
      window.removeEventListener('pageshow', scheduleMeasure)
      document.removeEventListener('visibilitychange', scheduleMeasure)
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
