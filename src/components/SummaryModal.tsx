import { useEffect, useRef, useState } from 'react'
import { useLang, t, type Lang } from '../lib/i18n'
import type { LifetimeStats } from '../lib/lifetimeStats'
import { FAREWELL_SENTENCES } from '../lib/lifetimeStats'
import type { PresenceMember } from '../lib/chatTypes'
import MessageAuthorCard from './MessageAuthorCard'
import { HourglassIcon } from './icons'

interface Props {
  stats: LifetimeStats
  presence: PresenceMember[]
  startedAt: number
  onComplete: () => void
  onFarewell: (userId: string, name: string, expiresAt: number, sentence: string) => void
}

function pickFarewell(lang: Lang): string {
  const list = FAREWELL_SENTENCES[lang] ?? FAREWELL_SENTENCES.en
  return list[Math.floor(Math.random() * list.length)]
}

const HEADLINE: Record<Lang, string> = {
  zh: '一个小时虽然短暂，过程却很丰富。说再见，继续旅程！',
  'zh-TW': '一個小時雖然短暫，過程卻很豐富。說再見，繼續旅程！',
  en: 'An hour is brief, yet the journey was rich. Say goodbye and continue onward!',
  ja: '一時間は短いが、旅は豊かだった。さようなら、そして旅を続けよう！',
  fr: 'Une heure est brève, mais le voyage fut riche. Dites au revoir et continuez la route !',
  es: 'Una hora es breve, pero el viaje fue rico. ¡Di adiós y sigue adelante!',
  de: 'Eine Stunde ist kurz, doch die Reise war reich. Sag auf Wiedersehen und geh weiter!',
  ko: '한 시간은 짧지만, 여행은 풍요로웠다. 안녕을 고하고 계속 나아가자!',
  it: 'Un’ora è breve, ma il viaggio è stato ricco. Dì addio e continua il cammino!',
  ar: 'ساعة قصيرة، لكن الرحلة كانت غنية. قل وداعاً وتابع المسير!',
}

const NEXT_JOURNEY: Record<Lang, string> = {
  zh: '下一段旅程',
  'zh-TW': '下一段旅程',
  en: 'Next journey',
  ja: '次の旅へ',
  fr: 'Prochain voyage',
  es: 'Próximo viaje',
  de: 'Nächste Reise',
  ko: '다음 여행',
  it: 'Prossimo viaggio',
  ar: 'الرحلة التالية',
}

export default function SummaryModal({ stats, presence, startedAt, onComplete, onFarewell }: Props) {
  const lang = useLang()
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

  const liveIds = new Set(presence.map((m) => m.userId))
  const interactions = Object.entries(stats.interactions).filter(([id]) => liveIds.has(id))

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
          <strong>{HEADLINE[lang]}</strong>
        </p>

        <div className="summary-stats">
          <div className="summary-stat-row">
            <span className="summary-stat-label">{t('本小时内发送消息', 'Messages sent this hour')}</span>
            <span className="summary-stat-value">{stats.messagesSent}</span>
          </div>
          <div className="summary-stat-row">
            <span className="summary-stat-label">{t('五子棋对局', 'Gomoku games')}</span>
            <span className="summary-stat-value">
              {stats.gomokuPlayed}
              <span className="summary-stat-sub">
                {t('胜', 'W')} {stats.gomokuWins} · {t('负', 'L')} {stats.gomokuLosses}
              </span>
            </span>
          </div>
          <div className="summary-stat-row">
            <span className="summary-stat-label">{t('中国象棋对局', 'Chinese Chess games')}</span>
            <span className="summary-stat-value">
              {stats.xiangqiPlayed}
              <span className="summary-stat-sub">
                {t('胜', 'W')} {stats.xiangqiWins} · {t('负', 'L')} {stats.xiangqiLosses}
              </span>
            </span>
          </div>
          {interactions.length > 0 && (
            <div className="summary-interactions">
              <div className="summary-stat-label">{t('互动过的用户', 'Users you interacted with')}</div>
              <div className="summary-interaction-list">
                {interactions.map(([id, name]) => {
                  const member = presence.find((m) => m.userId === id)
                  if (!member) return null
                  return (
                    <button
                      key={id}
                      type="button"
                      className="summary-interaction-name"
                      onClick={() => setSelected({ userId: id, name, member })}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
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
          {countdownText} {NEXT_JOURNEY[lang]}
        </button>
      </div>

      {selected && (
        <div
          className="welcome-backdrop"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={() => setSelected(null)}
        >
          <div className="welcome-card" style={{ maxWidth: 320 }} onClick={(e) => e.stopPropagation()}>
            <MessageAuthorCard member={selected.member} />
            <button
              type="button"
              className="btn-accent welcome-confirm"
              style={{ marginTop: 12 }}
              onClick={() => {
                const sentence = pickFarewell(lang)
                const expiresAt = selected.member.profileExpiresAt ?? Date.now() + 60 * 60 * 1000
                onFarewell(selected.userId, selected.name, expiresAt, sentence)
                setSelected(null)
              }}
            >
              {t('说再见', 'Say goodbye')}
            </button>
            <button
              type="button"
              className="account-close"
              onClick={() => setSelected(null)}
              aria-label={t('关闭', 'Close')}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
