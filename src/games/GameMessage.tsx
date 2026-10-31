import { useEffect, useRef, useState } from 'react'
import { parseGameRef } from './types'
import { getGameById } from './registry'
import type { PresenceMember } from '../lib/chatTypes'
import './GameMessage.css'

interface Props {
  content: string
  hostUserId: string
  onlineMembers?: PresenceMember[]
}

export default function GameMessage({ content, hostUserId, onlineMembers = [] }: Props) {
  const [isInView, setIsInView] = useState(false)
  const elementRef = useRef<HTMLDivElement>(null)
  const gameRef = parseGameRef(content)
  const instanceId = gameRef?.instanceId

  useEffect(() => {
    const element = elementRef.current
    if (!instanceId || !element) return
    const root = element.closest('.chat-log')
    let frame = 0
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
    document.addEventListener('visibilitychange', scheduleMeasure)
    scheduleMeasure()
    return () => {
      observer?.disconnect()
      root?.removeEventListener('scroll', scheduleMeasure)
      window.removeEventListener('resize', scheduleMeasure)
      document.removeEventListener('visibilitychange', scheduleMeasure)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [instanceId])

  if (!gameRef) return null
  const def = getGameById(gameRef.type)
  if (!def) return null
  const Component = def.Component
  const active = typeof IntersectionObserver === 'undefined' || isInView
  return (
    <div ref={elementRef} className="game-message-inview">
      {active
        ? <Component instanceId={gameRef.instanceId} hostUserId={hostUserId} onlineMembers={onlineMembers} />
        : <div className="game-message-placeholder" aria-hidden="true" />}
    </div>
  )
}
