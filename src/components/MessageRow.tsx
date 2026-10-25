import type { ChatEntry } from '../lib/chatTypes'
import { useLang } from '../lib/i18n'
import { isAutoTravelerName } from '../lib/nickname'
import { userAvatarTint, userNameColor } from '../lib/identity'
import CountdownRing from './CountdownRing'
import { TravelerGlyph } from './icons'

/** Twitter-style clock: 20:45. */
function formatClock(at: number): string {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function dayLabel(at: number, zh: boolean): string {
  const d = new Date(at)
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  if (zh) {
    const base = `${d.getMonth() + 1}月${d.getDate()}日`
    return sameYear ? base : `${d.getFullYear()}年${base}`
  }
  const monthDay = d.toLocaleString('en-US', { month: 'short', day: 'numeric' })
  return sameYear ? monthDay : `${monthDay}, ${d.getFullYear()}`
}

function sameDay(a: number, b: number): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

interface Props {
  entry: ChatEntry
  previous: ChatEntry | null
  mine: boolean
  onImageClick: (src: string) => void
  onRetry: () => void
}

/**
 * One message row (Discord layout): avatar gutter, name, clock and the
 * hour-glass countdown, then the text and/or photo. Rows carry their own
 * farewell — `.is-expiring` plays the dissolve while the sync layer
 * removes them from the list underneath.
 */
export default function MessageRow({ entry, previous, mine, onImageClick, onRetry }: Props) {
  const lang = useLang()
  const zh = lang === 'zh'
  const newDay = !previous || !sameDay(previous.at, entry.at)
  const grouped =
    !newDay &&
    previous !== null &&
    previous.userId === entry.userId &&
    entry.at - previous.at < 7 * 60_000

  const imageSrc = entry.imageUrl ?? entry.localImage ?? null

  const row = (
    <div
      id={`msg-${entry.id}`}
      className={[
        'msg-row',
        mine ? 'is-mine' : '',
        grouped ? 'is-grouped' : '',
        entry.state ? `is-${entry.state}` : '',
        entry.expiring ? 'is-expiring' : '',
      ].join(' ')}
    >
      <div className="msg-gutter" aria-hidden="true">
        {!grouped && (
          <span
            className="msg-avatar"
            style={{ background: userAvatarTint(entry.userId) }}
          >
            {isAutoTravelerName(entry.displayName) ? (
              <TravelerGlyph size={19} />
            ) : (
              entry.displayName.slice(0, 1).toUpperCase()
            )}
          </span>
        )}
      </div>
      <div className="msg-main">
        {!grouped && (
          <div className="msg-head">
            <span className="msg-name" style={{ color: userNameColor(entry.userId) }}>
              {entry.displayName}
              {mine && (
                <span style={{ opacity: 0.45, fontWeight: 600 }}>
                  {zh ? '（我）' : ' (you)'}
                </span>
              )}
            </span>
            <span className="msg-time">{formatClock(entry.at)}</span>
            <CountdownRing entry={entry} />
          </div>
        )}
        <div className="msg-body">
          {entry.content}
          {entry.state === 'pending' && (
            <span className="msg-state">{zh ? '发送中…' : ' sending…'}</span>
          )}
          {entry.state === 'failed' && (
            <button
              type="button"
              className="msg-state"
              onClick={onRetry}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
                font: 'inherit',
              }}
            >
              {zh ? '重试' : 'retry'}
            </button>
          )}
        </div>
        {imageSrc && (
          <img
            className={`msg-image${entry.state ? ' msg-image-pending' : ''}`}
            src={imageSrc}
            alt=""
            loading="lazy"
            decoding="async"
            onClick={() => !entry.expiring && onImageClick(imageSrc)}
          />
        )}
      </div>
    </div>
  )

  if (newDay) {
    return (
      <>
        <div className="chat-day-divider">
          <span>{dayLabel(entry.at, zh)}</span>
        </div>
        {row}
      </>
    )
  }
  return row
}
