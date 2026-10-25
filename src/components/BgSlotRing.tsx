import { useEffect, useState } from 'react'
import { t } from '../lib/i18n'
import { loadBgTtlMs } from '../lib/settings'
import { subscribeTick } from '../lib/tick'

/**
 * Ring-only countdown for the backdrop's remaining slot (no time text):
 * full when a photo goes on screen, empty when the next one crossfades in.
 * Shown in the bottom-right corner while the chat is folded away.
 */

const RING_RADIUS = 8
const RING_SIZE = 21
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export default function BgSlotRing({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => subscribeTick(() => setNow(Date.now())), [])

  const ttl = loadBgTtlMs()
  const remaining = Math.max(0, Math.min(ttl, since + ttl - now))
  const fraction = ttl > 0 ? remaining / ttl : 0
  const mm = Math.floor(remaining / 60_000)
  const ss = Math.floor((remaining % 60_000) / 1000)
  const readout = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`

  return (
    <span
      className="bg-slot-ring"
      aria-hidden="true"
      title={t(`背景 ${readout} 后更换`, `Backdrop changes in ${readout}`)}
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        focusable="false"
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.25"
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
    </span>
  )
}
