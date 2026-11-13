import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang, type Lang } from '../lib/i18n'

const COPY: Record<Lang, { label: string; title: string }> = {
  zh: { label: '星星积分', title: '发送消息、照片或玩游戏可获得积分' },
  'zh-TW': { label: '星星積分', title: '傳送訊息、照片或玩遊戲可獲得積分' },
  en: { label: 'Star points', title: 'Send messages, share photos, or play games to earn points' },
  ja: { label: 'スター ポイント', title: 'メッセージや写真を送信したり、ゲームをプレイしたりしてポイントを獲得' },
  fr: { label: 'Points étoile', title: 'Envoyez des messages ou des photos, ou jouez pour gagner des points' },
  es: { label: 'Puntos estrella', title: 'Envía mensajes o fotos, o juega para ganar puntos' },
  de: { label: 'Sternpunkte', title: 'Sende Nachrichten oder Fotos oder spiele, um Punkte zu verdienen' },
  ko: { label: '별 포인트', title: '메시지나 사진을 보내거나 게임을 플레이해 포인트를 획득하세요' },
  it: { label: 'Punti stella', title: 'Invia messaggi o foto, oppure gioca per guadagnare punti' },
  ar: { label: 'نقاط النجوم', title: 'أرسل رسائل أو صورًا، أو العب ألعابًا لكسب النقاط' },
}

export interface StarReward {
  id: string
  points: number
  kind?: 'message' | 'photo'
}

export function StarPointsCount({ score, className = '', label }: { score: number; className?: string; label?: string }) {
  return (
    <span className={`star-points-count${className ? ` ${className}` : ''}`} aria-label={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93L12 2.8Z" /></svg>
      <span className="star-score-value">{score.toLocaleString()}</span>
    </span>
  )
}

interface Props {
  score: number
  rewards: StarReward[]
  onRewardComplete: (reward: StarReward) => void
}

function makeFlight(source: HTMLElement, target: HTMLElement, finish: () => void) {
  let star: HTMLSpanElement | null = null
  let animation: Animation | null = null
  let startTimer = 0
  let fallbackTimer = 0

  startTimer = window.setTimeout(() => {
    if (!source.isConnected || !target.isConnected) {
      finish()
      return
    }
    const sourceRect = source.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    star = document.createElement('span')
    star.className = 'star-flight'
    star.setAttribute('aria-hidden', 'true')
    const core = document.createElement('span')
    core.className = 'star-flight-core'
    core.textContent = '★'
    star.append(core)
    for (let index = 0; index < 4; index += 1) {
      const spark = document.createElement('span')
      spark.className = 'star-flight-spark'
      spark.style.setProperty('--spark-angle', `${index * 90 + 45}deg`)
      star.append(spark)
    }
    star.style.left = `${sourceRect.left + sourceRect.width / 2}px`
    star.style.top = `${sourceRect.top + sourceRect.height / 2}px`
    document.body.append(star)

    const dx = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2)
    const dy = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2)
    const controlX = dx * 0.52 + (dx < 0 ? -54 : 54)
    const controlY = dy * 0.52 - Math.min(150, Math.max(70, Math.abs(dy) * 0.2))
    const keyframes = [
      { offset: 0, travel: 0, scale: 0.12, opacity: 0 },
      { offset: 0.045, travel: 0, scale: 1.72, opacity: 1 },
      { offset: 0.105, travel: 0.008, scale: 1.24, opacity: 1 },
      { offset: 0.18, travel: 0.045, scale: 1.2, opacity: 1 },
      { offset: 0.4, travel: 0.3, scale: 1.16, opacity: 1 },
      { offset: 0.68, travel: 0.66, scale: 1.12, opacity: 1 },
      { offset: 0.91, travel: 0.93, scale: 1.04, opacity: 1 },
      { offset: 0.97, travel: 0.99, scale: 0.9, opacity: 1 },
      { offset: 1, travel: 1, scale: 0.22, opacity: 0 },
    ].map(({ offset, travel, scale, opacity }) => {
      const inverse = 1 - travel
      const x = 2 * inverse * travel * controlX + travel * travel * dx
      const y = 2 * inverse * travel * controlY + travel * travel * dy
      return {
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`,
        opacity,
        offset,
      }
    })

    const complete = () => {
      star?.remove()
      finish()
    }
    if (typeof star.animate !== 'function') {
      fallbackTimer = window.setTimeout(complete, 3500)
      return
    }
    animation = star.animate(keyframes, {
      duration: 3500,
      easing: 'cubic-bezier(.18,.72,.28,1)',
      fill: 'forwards',
    })
    animation.onfinish = complete
  }, 500)

  return () => {
    window.clearTimeout(startTimer)
    window.clearTimeout(fallbackTimer)
    animation?.cancel()
    star?.remove()
  }
}

export default function StarScore({ score, rewards, onRewardComplete }: Props) {
  const lang = useLang()
  const copy = COPY[lang]
  const badgeRef = useRef<HTMLDivElement>(null)
  const completedRef = useRef(new Set<string>())
  const flightsRef = useRef(new Map<string, () => void>())
  const onCompleteRef = useRef(onRewardComplete)
  const completedBonusesRef = useRef(new Set<string>())
  const [pulsing, setPulsing] = useState(false)
  const [bonuses, setBonuses] = useState<StarReward[]>([])
  const [delta, setDelta] = useState<number | null>(null)

  useEffect(() => {
    const onDelta = (event: Event) => {
      const value = (event as CustomEvent<{ delta?: number }>).detail?.delta
      if (!value) return
      setDelta(value)
      window.setTimeout(() => setDelta(null), 1000)
    }
    window.addEventListener('one-hour:star-points-delta', onDelta)
    return () => window.removeEventListener('one-hour:star-points-delta', onDelta)
  }, [])

  useEffect(() => {
    onCompleteRef.current = onRewardComplete
  }, [onRewardComplete])

  useEffect(() => {
    const badge = badgeRef.current
    if (!badge) return
    for (const reward of rewards) {
      if (completedRef.current.has(reward.id)) continue
      const row = document.getElementById(`msg-${reward.id}`)
      const source = row?.querySelector('.msg-author-avatar-trigger')
      if (!(source instanceof HTMLElement)) continue
      completedRef.current.add(reward.id)
      const complete = () => {
        flightsRef.current.delete(reward.id)
        setBonuses((items) => [...items, reward])
      }
      const cancel = makeFlight(source, badge, complete)
      flightsRef.current.set(reward.id, cancel)
    }
  }, [rewards])

  const finishBonus = useCallback((reward: StarReward) => {
    if (completedBonusesRef.current.has(reward.id)) return
    completedBonusesRef.current.add(reward.id)
    onCompleteRef.current(reward)
    setBonuses((items) => items.filter((item) => item.id !== reward.id))
    setPulsing(true)
    window.setTimeout(() => setPulsing(false), 520)
  }, [])

  // CSS animations may be disabled by reduced-motion preferences, in which
  // case animationend never fires. Always release the visual reward either way.
  useEffect(() => {
    if (bonuses.length === 0) return
    const timer = window.setTimeout(() => bonuses.forEach(finishBonus), 1200)
    return () => window.clearTimeout(timer)
  }, [bonuses, finishBonus])

  useEffect(() => () => {
    flightsRef.current.forEach((cancel) => cancel())
    flightsRef.current.clear()
  }, [])

  return (
    <div
      ref={badgeRef}
      className={`star-score${pulsing ? ' is-pulsing' : ''}`}
      role="status"
      aria-label={`${copy.label}: ${score}`}
      title={copy.title}
    >
      <StarPointsCount score={score} />
      {delta !== null && <span className={`star-score-change${delta < 0 ? ' is-loss' : ''}`} aria-hidden="true">{delta > 0 ? '+' : ''}{delta}</span>}
      {bonuses.map((reward) => (
        <span
          key={reward.id}
          className="star-score-bonus"
          aria-hidden="true"
          onAnimationEnd={() => finishBonus(reward)}
        >
          +{reward.points}
        </span>
      ))}
    </div>
  )
}
