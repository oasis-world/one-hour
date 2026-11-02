/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react'

export function AiThinkingTimer({ active }: { active: boolean }) {
  const [sec, setSec] = useState(0)
  const startRef = useRef<number>(0)
  useEffect(() => {
    if (!active) return
    startRef.current = Date.now()
    setSec(0)
    const id = window.setInterval(() => {
      setSec(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [active])
  if (!active) return null
  return (
    <span className="game-ai-thinking-wrap" aria-hidden="true">
      <span className="game-ai-thinking-spinner" />
      <span className="game-ai-thinking-seconds" aria-live="polite">{sec}s</span>
    </span>
  )
}
