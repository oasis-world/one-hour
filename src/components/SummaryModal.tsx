import { useEffect, useRef, useState } from 'react'
import { useLang, t, type Lang } from '../lib/i18n'
import type { LifetimeStats, PendingSummary } from '../lib/lifetimeStats'
import { FAREWELL_SENTENCES } from '../lib/lifetimeStats'
import { FAREWELL_TTL_MS } from '../lib/expiry'
import type { PresenceMember } from '../lib/chatTypes'
import MessageAuthorCard from './MessageAuthorCard'
import AvatarBadge from './AvatarBadge'
import { GameIcon } from './icons'
import { StarPointsCount } from './StarScore'
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

function StatIcon({ type }: { type: 'message' | 'photo' | 'game' }) {
  if (type === 'message') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8 11h8M8 14h5" /></svg>
  if (type === 'photo') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 17 5-5 3 3 3-4 5 6" /></svg>
  return <GameIcon size={30} className="summary-game-icon" />
}

function StarMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93L12 2.8Z" /></svg>
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
  const gamesPlayed = stats.gomokuPlayed + stats.xiangqiPlayed + stats.chessPlayed
  const pointText = (points: number) => `${points > 0 ? '+' : ''}${points}`

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
          <div className="summary-metrics">
            <article className="summary-metric">
              <StatIcon type="message" />
              <strong className="summary-metric-value">{stats.messagesSent}</strong>
              <span className="summary-metric-label">{copy.messages}</span>
              <span className="summary-points" aria-label={`${copy.pointsLabel}: ${pointText(stats.messagePoints)}`}><StarMark />{pointText(stats.messagePoints)}</span>
            </article>
            <article className="summary-metric">
              <StatIcon type="photo" />
              <strong className="summary-metric-value">{stats.photosSent}</strong>
              <span className="summary-metric-label">{copy.photos}</span>
              <span className="summary-points" aria-label={`${copy.pointsLabel}: ${pointText(stats.photoPoints)}`}><StarMark />{pointText(stats.photoPoints)}</span>
            </article>
            <article className="summary-metric summary-metric-games">
              <StatIcon type="game" />
              <strong className="summary-metric-value">{gamesPlayed}</strong>
              <span className="summary-metric-label">{copy.games}</span>
              <span className={`summary-points${stats.gamePoints < 0 ? ' is-loss' : ''}`} aria-label={`${copy.pointsLabel}: ${pointText(stats.gamePoints)}`}><StarMark />{pointText(stats.gamePoints)}</span>
            </article>
          </div>

          <div className="summary-points-card">
            <div className="summary-balance-card">
              <span className="summary-balance-label">{copy.balanceLabel}</span>
              <StarPointsCount score={pointsBalance} className="summary-balance-count" label={`${copy.pointsLabel}: ${pointsBalance}`} />
            </div>
            <div className="summary-gifts">
              <strong>{copy.giftsSummary}</strong>
              {gifts.length > 0 ? <div className="summary-gift-list">
                {gifts.map((gift) => <span className="summary-gift-chip" key={gift.userId}><span>{gift.name}</span><b>+{gift.points}</b></span>)}
              </div> : <span className="summary-gifts-empty">{pointsBalance > 0 ? copy.noGifts : copy.noPoints}</span>}
            </div>
          </div>

          <div className="summary-interactions summary-interactions-card">
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
