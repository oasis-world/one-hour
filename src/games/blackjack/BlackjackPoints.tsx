import { useEffect, useRef, useState } from 'react'
import { t } from '../../lib/i18n'

export default function BlackjackPoints({ points }: { points: number }) {
  const [delta, setDelta] = useState<number | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    const onDelta = (event: Event) => {
      const value = (event as CustomEvent<{ delta?: unknown }>).detail?.delta
      if (typeof value !== 'number' || !value) return
      setDelta(value)
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setDelta(null), 1500)
    }
    window.addEventListener('one-hour:star-points-delta', onDelta)
    return () => {
      window.removeEventListener('one-hour:star-points-delta', onDelta)
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  return <div className={`bj-points${delta !== null ? ' is-changing' : ''}`} aria-label={`${t('星星积分', 'STAR POINTS')}: ${points.toLocaleString()}`}>
    <span className="bj-points-star" aria-hidden="true">✦</span>
    <span className="bj-points-copy"><strong>{points.toLocaleString()}</strong></span>
    {delta !== null && <span className={`bj-points-delta${delta < 0 ? ' is-negative' : ''}`} key={`${delta}-${points}`}>{delta > 0 ? '+' : '−'}{Math.abs(delta).toLocaleString()}</span>}
  </div>
}
