import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { parseGameRef } from './types'
import { getGameById } from './registry'
import type { PresenceMember } from '../lib/chatTypes'
import './GameMessage.css'

const GAME_VISIBILITY_MARGIN = 360

interface Props {
  content: string
  hostUserId: string
  onlineMembers?: PresenceMember[]
  initiallyVisible?: boolean
}

export default function GameMessage({ content, hostUserId, onlineMembers = [], initiallyVisible = false }: Props) {
  const [isInView, setIsInView] = useState(initiallyVisible)
  const [hasEverMounted, setHasEverMounted] = useState(initiallyVisible)
  const elementRef = useRef<HTMLDivElement>(null)
  const gameRef = parseGameRef(content)
  const instanceId = gameRef?.instanceId

  useEffect(() => {
    if (isInView) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasEverMounted(true)
    }
  }, [isInView])

  useLayoutEffect(() => {
    const element = elementRef.current
    if (!instanceId || !element) return
    const root = element.closest('.chat-log')
    const column = element.closest('.chat-column')
    let frame = 0
    let pendingDelta = 0
    let pendingRaf = 0
    let lastHeight = element.getBoundingClientRect().height
    let lastBottom = element.getBoundingClientRect().bottom
    const settleTimers: number[] = []

    const flushScrollDelta = () => {
      pendingRaf = 0
      if (!root || Math.abs(pendingDelta) < 0.5) {
        pendingDelta = 0
        return
      }
      const delta = pendingDelta
      pendingDelta = 0
      root.scrollTop += delta
      lastBottom += delta
    }

    const queueDelta = (delta: number) => {
      pendingDelta += delta
      if (pendingRaf) return
      pendingRaf = window.requestAnimationFrame(flushScrollDelta)
    }

    const measureVisibility = () => {
      frame = 0
      if (document.hidden) return
      const bounds = element.getBoundingClientRect()
      const rootBounds = root?.getBoundingClientRect()
      const left = Math.max(bounds.left, rootBounds?.left ?? 0, 0)
      const right = Math.min(bounds.right, rootBounds?.right ?? window.innerWidth, window.innerWidth)
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
        const distFromBottom = root ? root.scrollHeight - root.scrollTop - root.clientHeight : Infinity
        const isAtBottom = distFromBottom <= 56
        if (root && rootBounds && !isAtBottom && lastBottom <= rootBounds.top + 1 && Math.abs(heightDelta) > 0.5) {
          queueDelta(heightDelta)
        }
        lastHeight = nextHeight
        lastBottom = bounds.bottom
      }
      scheduleMeasure()
    })
    resizeObserver?.observe(element)
    if (root) resizeObserver?.observe(root)
    measureVisibility()
    scheduleMeasure()
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
      if (pendingRaf) window.cancelAnimationFrame(pendingRaf)
      for (const timer of settleTimers) window.clearTimeout(timer)
    }
  }, [instanceId])

  if (!gameRef) return null
  const def = getGameById(gameRef.type)
  if (!def) return null
  const Component = def.Component
  const isVisible = initiallyVisible || typeof IntersectionObserver === 'undefined' || isInView

  // Keep mounted after first visibility: no more placeholder↔card swaps that jitter scroll.
  // Offscreen cards stay in DOM with content-visibility:auto, but pause their Supabase channel via isVisible.
  return (
    <div ref={elementRef} className={`game-message-inview${isVisible ? ' is-mounted' : ''}${hasEverMounted ? ' has-mounted' : ''}`}>
      {hasEverMounted ? (
        <div className={`game-card-keepalive${isVisible ? ' is-inview' : ' is-offscreen'}`}>
          <Component instanceId={gameRef.instanceId} hostUserId={hostUserId} onlineMembers={onlineMembers} isVisible={isVisible} />
        </div>
      ) : (
        <div className="game-message-placeholder" data-game-type={gameRef.type} aria-hidden="true" />
      )}
    </div>
  )
}
