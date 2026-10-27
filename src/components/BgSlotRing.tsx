import { useEffect, useState } from 'react'
import { t } from '../lib/i18n'
import { loadBgTtlMs } from '../lib/settings'
import { subscribeTick } from '../lib/tick'
import CountdownVisual from './CountdownVisual'
import { GlobeIcon } from './userIcons'

/**
 * Folded-chat corner cluster, bottom-right: a ring countdown of the
 * backdrop's remaining slot (full when a photo goes on screen, empty —
 * clockwise — when the next one crossfades in), plus, when the backdrop
 * comes from the photo feed rather than the chat, a globe button that
 * opens the original image in a new tab. The mm:ss readout is always
 * shown above the ring (no tooltip / no tap-to-reveal).
 */

export default function BgSlotRing({
  since,
  link,
}: {
  since: number
  /** Feed-photo URL to open; null while a chat photo paints the stage. */
  link: string | null
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => subscribeTick(() => setNow(Date.now())), [])

  const ttl = loadBgTtlMs()
  const remaining = Math.max(0, Math.min(ttl, since + ttl - now))
  const fraction = ttl > 0 ? remaining / ttl : 0
  const mm = Math.floor(remaining / 60_000)
  const ss = Math.floor((remaining % 60_000) / 1000)
  const readout = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  const tipText = t(`背景 ${readout} 后更换`, `Backdrop changes in ${readout}`)

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
      <div className="bg-slot-ring" aria-label={tipText}>
        <CountdownVisual
          remaining={fraction}
          size={17}
          radius={7}
          strokeWidth={1.8}
          trackOpacity={0.25}
          className="bg-slot-countdown-visual"
        />
        <span className="bg-tip" aria-hidden="true">
          {readout}
        </span>
      </div>
    </div>
  )
}
