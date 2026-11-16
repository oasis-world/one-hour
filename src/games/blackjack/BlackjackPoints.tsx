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
    <span className="bj-points-star" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="m12 2.8 2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93L12 2.8Z" /></svg>
    </span>
    <span className="bj-points-copy"><strong>{points.toLocaleString()}</strong></span>
    {delta !== null && <span className={`bj-points-delta${delta < 0 ? ' is-negative' : ''}`} key={`${delta}-${points}`}>{delta > 0 ? '+' : '−'}{Math.abs(delta).toLocaleString()}</span>}
  </div>
}
