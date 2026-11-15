import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import AvatarBadge from '../../components/AvatarBadge'
import MessageAuthorCard from '../../components/MessageAuthorCard'
import { t } from '../../lib/i18n'
import { setPopoverOpen, suppressNextClick } from '../../lib/popoverGuard'
import type { PresenceMember } from '../../lib/chatTypes'
import { BJ_DEAL_MS, cardLabel, handValue, type BlackjackState, type Card as PlayingCard, type Hand, type Player } from './model'
import type { CSSProperties } from 'react'
import BlackjackCard from './BlackjackCard'
import './BlackjackTable.css'

function BotIcon({ size }: { size: number }) {
  return (
    <svg className="bj-dealer-avatar bj-bot-icon" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="bj-bot-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="1" stopColor="#f2c96a" />
        </linearGradient>
      </defs>
      <rect x="10" y="16" width="28" height="24" rx="8" fill="url(#bj-bot-face)" stroke="#b98a3a" strokeWidth="1.5" />
      <rect x="21" y="6" width="6" height="8" rx="2" fill="#f2c96a" stroke="#b98a3a" strokeWidth="1.2" />
      <circle cx="18" cy="27" r="3.2" fill="#2b3a33" />
      <circle cx="30" cy="27" r="3.2" fill="#2b3a33" />
      <circle cx="19.2" cy="25.6" r="1.1" fill="#ffffff" />
      <circle cx="31.2" cy="25.6" r="1.1" fill="#ffffff" />
      <path d="M18 33 Q24 37 30 33" fill="none" stroke="#2b3a33" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="28" r="2.4" fill="#f2c96a" stroke="#b98a3a" strokeWidth="1" />
      <circle cx="36" cy="28" r="2.4" fill="#f2c96a" stroke="#b98a3a" strokeWidth="1" />
    </svg>
  )
}

function memberForPlayer(player: Player): PresenceMember {
  return {
    userId: player.userId,
    displayName: player.name,
    avatarStyle: player.avatarStyle ?? 'thumbs',
    avatarSeed: player.avatarSeed ?? player.userId,
    avatarUrl: player.avatarUrl,
    enteredAt: 0,
  }
}

function SeatAvatarButton({ player }: { player: Player }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const member = memberForPlayer(player)

  const toggle = () => {
    const target = buttonRef.current
    if (!target) return
    const rect = target.getBoundingClientRect()
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - 284))
    const POPUP_H = 150
    const GAP = 8
    const PAD = 12
    const spaceBelow = window.innerHeight - rect.bottom
    const isBottomHalf = rect.top > window.innerHeight - 220
    const top = isBottomHalf || spaceBelow < POPUP_H + GAP
      ? Math.max(PAD, rect.top - POPUP_H - GAP)
      : rect.bottom + GAP
    setPosition({ left, top: Math.max(PAD, Math.min(top, window.innerHeight - POPUP_H - PAD)) })
    setPortalRoot(target.closest<HTMLElement>('.app-shell') ?? document.body)
    setOpen((current) => !current)
  }

  useEffect(() => {
    if (!open) return
    setPopoverOpen(true)
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (buttonRef.current?.contains(target) || popRef.current?.contains(target)) return
      suppressNextClick()
      setOpen(false)
    }
    window.addEventListener('pointerdown', dismiss, true)
    return () => {
      setPopoverOpen(false)
      window.removeEventListener('pointerdown', dismiss, true)
    }
  }, [open])

  return <>
    <button ref={buttonRef} type="button" className="bj-avatar-trigger" aria-label={player.name} onClick={toggle}>
      <AvatarBadge className="bj-avatar" size={30} look={{ style: player.avatarStyle || 'thumbs', seed: player.avatarSeed || player.userId, url: player.avatarUrl }} />
    </button>
    {open && position && createPortal(
      <div ref={popRef} className="author-pop-portal" style={{ left: position.left, top: position.top }}>
        <MessageAuthorCard member={member} />
      </div>,
      portalRoot ?? document.body,
    )}
  </>
}

/**
 * Card lands first, score follows: while a newly dealt card is still
 * animating, keep showing the previous total; flip to the live total the
 * moment the card is in place. A brand-new deal (all card ids replaced,
 * e.g. rematch) counts as "grew" even when the hand length is unchanged.
 */
function useLandedScore(cards: PlayingCard[], hidden: boolean, lastStaggerMs: number) {
  const live = hidden ? null : handValue(cards)
  const [shown, setShown] = useState(live)
  const [landed, setLanded] = useState(true)
  const lenRef = useRef(0)
  const sigRef = useRef('')
  useEffect(() => {
    const sig = cards.map((card) => card.id).join(',')
    const prevIds = sigRef.current ? new Set(sigRef.current.split(',')) : null
    const freshDeal = Boolean(prevIds && sig !== sigRef.current && !cards.some((card) => prevIds.has(card.id)))
    sigRef.current = sig
    if (hidden) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(null)
      setLanded(true)
      lenRef.current = cards.length
      return
    }
    const value = handValue(cards)
    if ((cards.length > lenRef.current || freshDeal) && cards.length > 0) {
      lenRef.current = cards.length
      const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) {
        setShown(value)
        setLanded(true)
        return
      }
      setLanded(false)
      const timer = window.setTimeout(() => {
        setShown(value)
        setLanded(true)
      }, lastStaggerMs + BJ_DEAL_MS)
      return () => window.clearTimeout(timer)
    }
    lenRef.current = cards.length
    setShown(value)
    setLanded(true)
  }, [cards, hidden, lastStaggerMs])
  return { shown: shown ?? live, landed }
}

function HandView({ hand, hidden, result, active = false, dealOrder = 0, lastStaggerMs, avatar }: { hand: Hand; hidden: boolean; result?: string; active?: boolean; dealOrder?: number; lastStaggerMs?: number; avatar?: ReactNode }) {
  const stagger = lastStaggerMs ?? Math.min(dealOrder + Math.max(hand.cards.length - 1, 0), 12) * 150
  const { shown, landed } = useLandedScore(hand.cards, hidden, stagger)
  const score = shown ?? handValue(hand.cards)
  const resultText: Record<string, string> = { win: t('获胜', 'WIN'), lose: t('落败', 'LOSE'), push: t('平局', 'PUSH'), bust: t('爆牌', 'BUST'), blackjack: t('黑杰克', 'BLACKJACK') }
  return <div className={`bj-hand${active ? ' is-current' : ''}${result ? ` is-${result}` : ''}`}>
    <div className="bj-hand-meta">
      {avatar}
      <strong className="bj-score-pill">{hidden ? cardLabel(hand.cards[0]) : score.total}</strong>{!hidden && score.soft && <small>{t('软牌', 'SOFT')}</small>}
      {landed && result && <span className="bj-hand-result">{resultText[result] ?? result}</span>}
      {hand.doubled && <small>{t('已加倍', 'DOUBLED')}</small>}
      {landed && result && hand.payout > 0 && <small className="bj-payout">{result === 'push' ? `↩ ${hand.payout}` : `+${hand.payout - hand.bet}`}</small>}
    </div>
    <div className="bj-cards" aria-label={t('手牌', 'Hand')}>
      {hand.cards.map((card, index) => <span className="bj-card-stack" key={card.id} style={{ zIndex: index, animationDelay: `${Math.min(dealOrder + index, 12) * 150}ms` }}>
        <BlackjackCard card={card} back={hidden && index === 1} />
      </span>)}
    </div>
  </div>
}

function PlayerSeat({ player, active, results }: { player: Player; active: boolean; results: BlackjackState['results'] }) {
  const bet = player.hands.reduce((sum, hand) => sum + hand.bet, 0)
  return <article className={`bj-seat${active ? ' is-active' : ''}`}>
    <div
      className="bj-player-hands"
      style={{ '--bj-deal-x': '260px', '--bj-deal-y': '-170px' } as CSSProperties}
    >
      {player.hands.map((hand, handIndex) => <div className="bj-player-hand" key={`${player.userId}-${handIndex}`}>
        <HandView hand={hand} hidden={false} active={active} result={results[`${player.userId}:${handIndex}`]} dealOrder={0} avatar={<SeatAvatarButton player={player} />} />
      </div>)}
    </div>
    <div className="bj-stake-chip" aria-label={`${t('下注', 'BET')} ${bet} ${t('星星积分', 'STAR POINTS')}`}>
      <img className="bj-chip-image" src="/games/blackjack/chip.svg" alt="" draggable="false" />
      <small>{bet}</small>
    </div>
  </article>
}

function DealerHandView({ dealerHand, hideHoleCard, playersCount, avatar }: { dealerHand: PlayingCard[]; hideHoleCard: boolean; playersCount: number; avatar: ReactNode }) {
  const lastStagger = (playersCount + Math.max(dealerHand.length - 1, 0)) * 180
  const { shown } = useLandedScore(dealerHand, false, lastStagger)
  const full = shown ?? handValue(dealerHand)
  const first = handValue(dealerHand.slice(0, 1))
  return <div className="bj-dealer-hand">
    {dealerHand.length > 0 && <div className="bj-hand-meta">
      {avatar}
      <strong className="bj-score-pill">{hideHoleCard ? first.total : full.total}</strong>{!hideHoleCard && full.soft && <small>{t('软牌', 'SOFT')}</small>}
    </div>}
    <div className="bj-cards" aria-label={t('庄家手牌', "Dealer's hand")}>
      {dealerHand.map((card, index) => <span className="bj-card-stack" key={card.id} style={{ zIndex: index, '--bj-deal-x': '230px', '--bj-deal-y': '-95px', animationDelay: `${(playersCount + index) * 180}ms` } as CSSProperties}>
        <BlackjackCard card={card} back={hideHoleCard && index === 1} />
      </span>)}
    </div>
  </div>
}

export default function BlackjackTable({ state }: { state: BlackjackState }) {
  const hideHoleCard = state.phase === 'players'
  const isIdle = state.dealerHand.length === 0
  return <div className="bj-table" aria-label={t('21 点 · 黑杰克', 'Blackjack table')}>
     <section className="bj-dealer-zone">
      {isIdle ? <div className="bj-idle-deck" aria-hidden="true">
        <span /><span /><span />
      </div> : <>
      <div className="bj-dealer-card">
        <DealerHandView dealerHand={state.dealerHand} hideHoleCard={hideHoleCard} playersCount={Math.max(state.players.length, 1)} avatar={<BotIcon size={30} />} />
      </div>
      <div className="bj-dealer-shoe" aria-hidden="true">
        <span /><span /><span />
      </div>
      </>}
    </section>
    <section className={`bj-seats${state.players.length > 2 ? ' has-many' : ''}`} data-count={state.players.length} aria-label={t('玩家座位', 'Player seats')}>
      {state.players.map((player) => <PlayerSeat
        key={player.userId}
        player={player}
        active={state.phase === 'players'}
        results={state.results}
      />)}
    </section>
  </div>
}
