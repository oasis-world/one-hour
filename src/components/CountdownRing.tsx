import { useEffect, useState } from 'react'
import { MESSAGE_TTL_MS, expiresAtOf } from '../lib/expiry'
import { t } from '../lib/i18n'
import { subscribeTick } from '../lib/tick'
import type { ChatEntry } from '../lib/chatTypes'
import CountdownVisual from './CountdownVisual'

/**
 * The one-hour countdown: a depleting ring with a mm:ss readout, next to
 * the message's send time. Amber in the final ten minutes, pulsing red in
 * the last two.
 */

type Phase = 'fresh' | 'late' | 'final'

export default function CountdownRing({ entry }: { entry: ChatEntry }) {
  const expiresAt = expiresAtOf(entry)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => subscribeTick(() => setNow(Date.now())), [])

  const remaining = Math.max(0, expiresAt - now)
  const fraction = Math.min(1, remaining / MESSAGE_TTL_MS)
  const phase: Phase = remaining <= 2 * 60_000 ? 'final' : remaining <= 10 * 60_000 ? 'late' : 'fresh'
  const mm = Math.floor(remaining / 60_000)
  const ss = Math.floor((remaining % 60_000) / 1000)
  const readout = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`

  return (
    <span
      className={`msg-countdown${phase === 'late' ? ' is-late' : ''}${phase === 'final' ? ' is-final' : ''}`}
      title={t(`这条消息还剩 ${readout} 消失`, `Vanishes in ${readout}`)}
    >
      <CountdownVisual
        remaining={fraction}
        size={17}
        radius={6.5}
        strokeWidth={1.6}
        trackOpacity={0.22}
        className="msg-countdown-visual"
      />
      <span className="msg-countdown-text">{readout}</span>
    </span>
  )
}
