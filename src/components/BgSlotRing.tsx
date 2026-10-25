import { useEffect, useRef, useState } from 'react'
import { t } from '../lib/i18n'
import { loadBgTtlMs } from '../lib/settings'
import { subscribeTick } from '../lib/tick'
import { GlobeIcon } from './userIcons'

/**
 * Folded-chat corner cluster, bottom-right: a ring countdown of the
 * backdrop's remaining slot (full when a photo goes on screen, empty —
 * clockwise — when the next one crossfades in), plus, when the backdrop
 * comes from the photo feed rather than the chat, a globe button that
 * opens the original image in a new tab. The ring is a button too:
 * hovering it (desktop) or tapping it (touch) floats the mm:ss readout.
 */

const RING_RADIUS = 7
const RING_SIZE = 17
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const TIP_AUTO_CLOSE_MS = 2500

export default function BgSlotRing({
  since,
  link,
}: {
  since: number
  /** Feed-photo URL to open; null while a chat photo paints the stage. */
  link: string | null
}) {
  const [now, setNow] = useState(() => Date.now())
  const [tipOpen, setTipOpen] = useState(false)
  const tipTimer = useRef<number | null>(null)

  useEffect(() => subscribeTick(() => setNow(Date.now())), [])

  useEffect(
    () => () => {
      if (tipTimer.current) window.clearTimeout(tipTimer.current)
    },
    [],
  )

  const ttl = loadBgTtlMs()
  const remaining = Math.max(0, Math.min(ttl, since + ttl - now))
  const fraction = ttl > 0 ? remaining / ttl : 0
  const mm = Math.floor(remaining / 60_000)
  const ss = Math.floor((remaining % 60_000) / 1000)
  const readout = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  const tipText = t(`背景 ${readout} 后更换`, `Backdrop changes in ${readout}`)

  /** Touch toggles the readout; the hover path needs no state. */
  const toggleTip = () => {
    setTipOpen((v) => {
      const next = !v
      if (tipTimer.current) window.clearTimeout(tipTimer.current)
      if (next) {
        tipTimer.current = window.setTimeout(() => setTipOpen(false), TIP_AUTO_CLOSE_MS)
      }
      return next
    })
  }

  return (
    <div className="bg-corner">
      {link && (
        <button
          type="button"
          className="bg-link-btn"
          aria-label={t('查看背景原图', 'Open backdrop source')}
          title={t('查看背景原图', 'Open backdrop source')}
          onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}
        >
          <GlobeIcon size={14} />
        </button>
      )}
      <button
        type="button"
        className={`bg-slot-ring${tipOpen ? ' is-tip-open' : ''}`}
        aria-label={tipText}
        onClick={toggleTip}
      >
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          focusable="false"
          aria-hidden="true"
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            opacity="0.25"
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            /* Negative offset keeps the tail at 12 o'clock — clockwise
               depletion, same language as the message rings. */
            strokeDashoffset={-CIRCUMFERENCE * (1 - fraction)}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <span className="bg-tip" aria-hidden="true">
          {tipText}
        </span>
      </button>
    </div>
  )
}
