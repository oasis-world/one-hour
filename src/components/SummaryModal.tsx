import { useEffect, useRef, useState } from 'react'
import { useLang, t, type Lang } from '../lib/i18n'
import type { LifetimeStats } from '../lib/lifetimeStats'
import { FAREWELL_SENTENCES } from '../lib/lifetimeStats'
import type { PresenceMember } from '../lib/chatTypes'
import MessageAuthorCard from './MessageAuthorCard'
import { HourglassIcon } from './icons'
import { SUMMARY_COPY } from './summaryCopy'

interface Props {
  stats: LifetimeStats
  presence: PresenceMember[]
  selfId: string | null
  startedAt: number
  onComplete: () => void
  onFarewell: (userId: string, name: string, expiresAt: number, sentence: string) => void
}

function pickFarewell(lang: Lang): string {
  const list = FAREWELL_SENTENCES[lang] ?? FAREWELL_SENTENCES.en
  return list[Math.floor(Math.random() * list.length)]
}

export default function SummaryModal({ stats, presence, selfId, startedAt, onComplete, onFarewell }: Props) {
  const lang = useLang()
  const copy = SUMMARY_COPY[lang]
  const [now, setNow] = useState(startedAt)
  const [selected, setSelected] = useState<{ userId: string; name: string; member: PresenceMember } | null>(null)
  const completedRef = useRef(false)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const remaining = Math.max(0, 60_000 - (now - startedAt))
  useEffect(() => {
    if (remaining <= 0 && !completedRef.current) {
      completedRef.current = true
      onComplete()
    }
  }, [remaining, onComplete])

  const liveMembers = new Map(
    presence
      .filter((member) => member.userId !== selfId && (!member.profileExpiresAt || member.profileExpiresAt > now))
      .map((member) => [member.userId, member]),
  )
  const interactions = Object.entries(stats.interactions).filter(([id]) => liveMembers.has(id))

  const mm = Math.floor(remaining / 60000)
  const ss = Math.floor((remaining % 60000) / 1000)
  const countdownText = `${mm}:${String(ss).padStart(2, '0')}`

  return (
    <div className="welcome-backdrop" role="presentation">
      <div className="welcome-card" role="dialog" aria-modal="true" aria-label={t('一小时聊天室', 'the one-hour room')}>
        <h2 className="welcome-title">
          <HourglassIcon size={20} />
          {t('一小时聊天室', 'the one-hour room')}
        </h2>
        <p className="welcome-copy">
          <strong>{copy.headline}</strong>
          <strong>{copy.farewell}</strong>
        </p>

        <div className="summary-stats">
          <div className="summary-stat-row">
            <span className="summary-stat-label">{copy.messages}</span>
            <span className="summary-stat-value">{stats.messagesSent}</span>
          </div>
          <div className="summary-stat-row">
            <span className="summary-stat-label">{copy.gomoku}</span>
            <span className="summary-stat-value">
              {stats.gomokuPlayed}
              <span className="summary-stat-sub">
                {copy.wins} {stats.gomokuWins} · {copy.losses} {stats.gomokuLosses}
              </span>
            </span>
          </div>
          <div className="summary-stat-row">
            <span className="summary-stat-label">{copy.xiangqi}</span>
            <span className="summary-stat-value">
              {stats.xiangqiPlayed}
              <span className="summary-stat-sub">
                {copy.wins} {stats.xiangqiWins} · {copy.losses} {stats.xiangqiLosses}
              </span>
            </span>
          </div>
          <div className="summary-interactions">
            <div className="summary-stat-label">{copy.interactions}</div>
            {interactions.length > 0 ? (
              <div className="summary-interaction-list">
                {interactions.map(([id, name]) => {
                  const member = liveMembers.get(id)
                  if (!member) return null
                  return (
                    <button
                      key={id}
                      type="button"
                      className="summary-interaction-name"
                      onClick={() => setSelected({ userId: id, name: member.displayName || name, member })}
                    >
                      {member.displayName || name}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="summary-interaction-empty">{copy.noInteractions}</div>
            )}
          </div>
        </div>

        <button
          type="button"
          className="btn-accent welcome-confirm"
          onClick={() => {
            if (!completedRef.current) {
              completedRef.current = true
              onComplete()
            }
          }}
        >
          {countdownText} {copy.nextJourney}
        </button>
      </div>

      {selected && (
        <div
          className="welcome-backdrop"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={() => setSelected(null)}
        >
          <div
            className="welcome-card summary-author-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={selected.name}
            style={{ maxWidth: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <MessageAuthorCard member={selected.member} className="summary-author-card" />
            <button
              type="button"
              className="btn-accent welcome-confirm"
              style={{ marginTop: 12 }}
              onClick={() => {
                const sentence = pickFarewell(lang)
                const expiresAt = selected.member.profileExpiresAt ?? Date.now() + 60 * 60 * 1000
                if (expiresAt <= Date.now()) {
                  setSelected(null)
                  return
                }
                onFarewell(selected.userId, selected.name, expiresAt, sentence)
                setSelected(null)
              }}
            >
              {copy.sayGoodbye}
            </button>
            <button
              type="button"
              className="account-close"
              onClick={() => setSelected(null)}
              aria-label={copy.close}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
