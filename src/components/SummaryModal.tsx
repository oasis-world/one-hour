import { useEffect, useRef, useState } from 'react'
import { useLang, t, type Lang } from '../lib/i18n'
import type { LifetimeStats, PendingSummary } from '../lib/lifetimeStats'
import { FAREWELL_SENTENCES } from '../lib/lifetimeStats'
import { FAREWELL_TTL_MS } from '../lib/expiry'
import type { PresenceMember } from '../lib/chatTypes'
import MessageAuthorCard from './MessageAuthorCard'
import AvatarBadge from './AvatarBadge'
import { HourglassIcon } from './icons'
import { SUMMARY_COPY } from './summaryCopy'

interface Props {
  stats: LifetimeStats
  presence: PresenceMember[]
  selfId: string | null
  profile?: PendingSummary['profile']
  pointsBalance: number
  gifts: NonNullable<PendingSummary['gifts']>
  onComplete: () => void
  onFarewell: (userId: string, name: string, expiresAt: number, sentence: string) => void
}

function pickFarewell(lang: Lang): string {
  const list = FAREWELL_SENTENCES[lang] ?? FAREWELL_SENTENCES.en
  return list[Math.floor(Math.random() * list.length)]
}

function format(copy: string, values: Record<string, number>): string {
  return copy.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? 0))
}

export default function SummaryModal({ stats, presence, selfId, profile, pointsBalance, gifts, onComplete, onFarewell }: Props) {
  const lang = useLang()
  const copy = SUMMARY_COPY[lang]
  const [now, setNow] = useState(0)
  const [selected, setSelected] = useState<{ userId: string; name: string; member: PresenceMember } | null>(null)
  const completedRef = useRef(false)

  useEffect(() => {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
    if (coarse || window.innerWidth <= 820) {
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.blur()
    }
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const liveMembers = new Map(
    presence.filter((member) => member.userId !== selfId && (!member.profileExpiresAt || member.profileExpiresAt > now))
      .map((member) => [member.userId, member]),
  )
  const interactions = Object.entries(stats.interactions).filter(([id]) => liveMembers.has(id))
  const gameLine = format(copy.gameSummary, {
    gomoku: stats.gomokuPlayed, xiangqi: stats.xiangqiPlayed, chess: stats.chessPlayed, points: stats.gamePoints,
  })

  return (
    <div className="welcome-backdrop" role="presentation">
      <div className="welcome-card summary-card" dir={lang === 'ar' ? 'rtl' : 'ltr'} role="dialog" aria-modal="true" aria-label={t('一小时聊天室', 'the one-hour room')}>
        <h2 className="welcome-title"><HourglassIcon size={20} />{t('一小时聊天室', 'the one-hour room')}</h2>
        {profile && <div className="summary-profile">
          <AvatarBadge look={{ style: profile.style, seed: profile.seed, avatarUrl: profile.avatarUrl }} size={34} className="summary-profile-avatar" />
          <strong>{profile.nickname}</strong>
        </div>}
        <p className="welcome-copy summary-copy"><strong>{copy.headline}</strong> <span>{copy.farewell}</span></p>

        <div className="summary-stats">
          <div className="summary-stat-row"><span>{format(copy.messageSummary, { count: stats.messagesSent, points: stats.messagePoints })}</span></div>
          <hr className="summary-divider" />
          <div className="summary-stat-row"><span>{format(copy.photoSummary, { count: stats.photosSent, points: stats.photoPoints })}</span></div>
          <hr className="summary-divider" />
          <div className="summary-stat-row"><span>{gameLine}</span></div>
          <hr className="summary-divider" />
          <div className="summary-stat-row summary-balance"><strong>{format(copy.balanceSummary, { points: pointsBalance })}</strong></div>
          {gifts.length > 0 ? <div className="summary-gifts">
            <strong>{copy.giftsSummary}</strong>
            {gifts.map((gift) => <span key={gift.userId}>{gift.name} +{gift.points}</span>)}
          </div> : <div className="summary-gifts"><span>{pointsBalance > 0 ? copy.noGifts : copy.noPoints}</span></div>}

          <hr className="summary-divider" />
          <div className="summary-interactions">
            <div className="summary-stat-label">{copy.interactions}</div>
            {interactions.length > 0 ? <div className="summary-interaction-list">
              {interactions.map(([id, name]) => {
                const member = liveMembers.get(id)
                if (!member) return null
                return <button key={id} type="button" className="summary-interaction-name" onClick={() => setSelected({ userId: id, name: member.displayName || name, member })}>
                  {member.displayName || name}
                </button>
              })}
            </div> : <div className="summary-interaction-empty">{copy.noInteractions}</div>}
          </div>
        </div>

        <button type="button" className="btn-accent welcome-confirm" onClick={() => {
          if (completedRef.current) return
          completedRef.current = true
          onComplete()
        }}>{copy.nextJourney}</button>
      </div>

      {selected && <div className="welcome-backdrop summary-selected-backdrop" onClick={() => setSelected(null)}>
        <div className="welcome-card summary-author-dialog" role="dialog" aria-modal="true" aria-label={selected.name} onClick={(event) => event.stopPropagation()}>
          <MessageAuthorCard member={selected.member} className="summary-author-card" />
          <button type="button" className="btn-accent welcome-confirm" onClick={() => {
            const sentence = pickFarewell(lang)
            onFarewell(selected.userId, selected.name, Date.now() + FAREWELL_TTL_MS, sentence)
            setSelected(null)
          }}>{copy.sayGoodbye}</button>
          <button type="button" className="account-close" onClick={() => setSelected(null)} aria-label={copy.close}>×</button>
        </div>
      </div>}
    </div>
  )
}
