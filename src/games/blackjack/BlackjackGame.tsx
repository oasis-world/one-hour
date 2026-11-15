import { useCallback, useEffect, useRef, useState } from 'react'
import { t, useLang } from '../../lib/i18n'
import { adjustStarPoints } from '../../lib/starPoints'
import { recordGamePlayed, recordGamePoints } from '../../lib/lifetimeStats'
import type { GameComponentProps } from '../types'
import { blackjackSound } from './sound'
import BlackjackControls from './BlackjackControls'
import BlackjackLeaveDialog from './BlackjackLeaveDialog'
import BlackjackPoints from './BlackjackPoints'
import { useBlackjackPoints } from './useBlackjackPoints'
import BlackjackTable from './BlackjackTable'
import { useBlackjackRoom } from './useBlackjackRoom'
import { useBlackjackSound } from './useBlackjackSound'
import { BASE_BET, BJ_DEAL_MS } from './model'
import './BlackjackGame.css'

type RoundToast = { outcome: 'win' | 'push' | 'lose'; net: number; payout: number; stake: number }

function SoundIcon({ enabled }: { enabled: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9v6h4l5 4V5L8 9H4Z" />
    {enabled ? <><path d="M16 9a5 5 0 0 1 0 6" /><path d="M18.5 6.5a8.5 8.5 0 0 1 0 11" /></> : <path d="m5 5 14 14" />}
  </svg>
}

export default function BlackjackGame({ instanceId }: GameComponentProps) {
  const lang = useLang()
  const room = useBlackjackRoom(instanceId)
  const starPoints = useBlackjackPoints()
  const [selectedBet, setSelectedBet] = useState(BASE_BET)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [roundToast, setRoundToast] = useState<RoundToast | null>(null)
  const { sound, toggle } = useBlackjackSound(instanceId)
  const lastDeckCount = useRef<number | null>(null)
  const recordedRound = useRef(0)
  const toastedRound = useRef(0)
  const toastTimer = useRef<number | null>(null)
  const pointsLedger = useRef({ key: '', debited: 0, settled: false })
  const pendingSettlement = useRef<{ key: string; stake: number; balanceDelta: number; gameNet: number } | null>(null)
  // Points move only after the win/lose toast has finished (or when leaving /
  // starting the next round early), so the number never jumps mid-animation.
  const flushSettlement = useCallback(() => {
    const pending = pendingSettlement.current
    pendingSettlement.current = null
    if (!pending) return
    let claimed = false
    try { claimed = Boolean(JSON.parse(localStorage.getItem(pending.key) ?? 'null')?.settled) } catch { /* Best effort duplicate guard. */ }
    pointsLedger.current = { key: pending.key, debited: pending.stake, settled: true }
    if (claimed) return
    try { localStorage.setItem(pending.key, JSON.stringify({ debited: pending.stake, settled: true })) } catch { /* Best effort duplicate guard. */ }
    if (pending.balanceDelta) adjustStarPoints(pending.balanceDelta, true)
    recordGamePoints(pending.gameNet)
  }, [])
  const changeBet = (bet: number) => {
    setSelectedBet(bet)
  }
  const playAction = (action: 'hit' | 'stand' | 'double') => {
    if (action === 'double') blackjackSound(instanceId, 'chip')
    room.act(action)
  }
  const requestLeave = useCallback(() => setLeaveConfirmOpen(true), [])
  const cancelLeave = useCallback(() => setLeaveConfirmOpen(false), [])
  const confirmLeave = useCallback(() => {
    setLeaveConfirmOpen(false)
    setRoundToast(null)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    flushSettlement()
    room.leave()
  }, [room, flushSettlement])
  const rematch = useCallback(() => {
    setRoundToast(null)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    flushSettlement()
    room.rematch(selectedBet)
  }, [room, selectedBet, flushSettlement])

  useEffect(() => {
    if (room.state.round && room.state.round !== recordedRound.current && room.state.players.length > 0) {
      recordGamePlayed('blackjack', `${instanceId}:${room.state.round}`)
      recordedRound.current = room.state.round
    }
  }, [instanceId, room.state.round, room.state.players])

  useEffect(() => {
    if (!room.selfId || !room.state.round) return
    const player = room.state.players[0]
    if (!player) return
    const key = `blackjack-points:${instanceId}:${room.selfId}:${room.state.round}`
    if (pointsLedger.current.key !== key) {
      let saved: { debited?: number; settled?: boolean } | null = null
      try { saved = JSON.parse(localStorage.getItem(key) ?? 'null') } catch { /* Local balance remains usable. */ }
      pointsLedger.current = { key, debited: saved?.debited ?? 0, settled: saved?.settled ?? false }
    }
    const ledger = pointsLedger.current
    if (ledger.settled) return
    const stake = player.hands.reduce((sum, hand) => sum + hand.bet, 0)
    if (room.state.phase === 'result') {
      const payout = player.hands.reduce((sum, hand) => sum + hand.payout, 0)
      const balanceDelta = payout - (stake - ledger.debited)
      pointsLedger.current = { key, debited: stake, settled: true }
      pendingSettlement.current = { key, stake, balanceDelta, gameNet: payout - stake }
      return
    }
    const additionalStake = stake - ledger.debited
    if (additionalStake <= 0) return
    pointsLedger.current = { key, debited: stake, settled: false }
    try { localStorage.setItem(key, JSON.stringify({ debited: stake, settled: false })) } catch { /* Best effort duplicate guard. */ }
    adjustStarPoints(-additionalStake, true)
  }, [instanceId, room.selfId, room.state])

  useEffect(() => {
    if (room.state.phase === 'lobby') return
    if (lastDeckCount.current !== room.state.deck.length) {
      blackjackSound(instanceId, 'deal')
      lastDeckCount.current = room.state.deck.length
    }
  }, [instanceId, room.selfId, room.state])

  useEffect(() => {
    if (room.state.phase !== 'result' || !room.selfId || room.state.round === toastedRound.current) return
    const player = room.state.players[0]
    if (!player) return
    toastedRound.current = room.state.round
    const payout = player.hands.reduce((sum, hand) => sum + hand.payout, 0)
    const stake = player.hands.reduce((sum, hand) => sum + hand.bet, 0)
    const net = payout - stake
    const outcome = net > 0 ? 'win' : net === 0 ? 'push' : 'lose'
    const nextToast: RoundToast = { outcome, net, payout, stake }
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    // Show the toast 1s after the last card lands: max deal stagger + deal animation + 1s pause.
    // Points settle when the toast finishes hiding, never mid-animation.
    const reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let maxStagger = 0
    player.hands.forEach((hand, handIndex) => hand.cards.forEach((_, cardIndex) => {
      maxStagger = Math.max(maxStagger, Math.min(Math.min(handIndex, 7) + cardIndex, 12) * 150)
    }))
    room.state.dealerHand.forEach((_, cardIndex) => {
      maxStagger = Math.max(maxStagger, (room.state.players.length + cardIndex) * 180)
    })
    const revealDelay = reducedMotion ? 1000 : Math.min(maxStagger + BJ_DEAL_MS + 1000, 6000)
    toastTimer.current = window.setTimeout(() => {
      setRoundToast(nextToast)
      blackjackSound(instanceId, net >= 0 ? 'win' : 'lose')
      toastTimer.current = window.setTimeout(() => {
        setRoundToast(null)
        flushSettlement()
      }, 3500)
    }, revealDelay)
  }, [instanceId, room.selfId, room.state, flushSettlement])

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    flushSettlement()
  }, [flushSettlement])

  // A stood hand (bust / 21 / double / natural) stays on the table until its
  // last card has landed; only then is the turn handed to the dealer, so the
  // dealer never reveals while the player's card is still flying in.
  // (A manual stand adds no card, so it hands over immediately in the model.)
  const advanceTurn = room.advance
  const runDealer = room.finishDealer
  const tablePhase = room.state.phase
  const tableRound = room.state.round
  const stoodLongest = tablePhase === 'players'
    ? (room.state.players[0]?.hands ?? []).filter((hand) => hand.stood).reduce((n, hand) => Math.max(n, hand.cards.length), 0)
    : 0
  const stoodSig = tablePhase === 'players'
    ? (room.state.players[0]?.hands ?? []).filter((hand) => hand.stood).map((hand) => hand.cards.map((card) => card.id).join(',')).join(';')
    : ''
  useEffect(() => {
    if (tablePhase !== 'players' || !stoodLongest) return
    const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const wait = reduced ? 0 : Math.min(stoodLongest - 1, 12) * 150 + BJ_DEAL_MS + 250
    const timer = window.setTimeout(() => advanceTurn(), wait)
    return () => window.clearTimeout(timer)
  }, [advanceTurn, tablePhase, stoodLongest, stoodSig])
  useEffect(() => {
    if (tablePhase !== 'dealer') return
    const timer = window.setTimeout(() => runDealer(), 650)
    return () => window.clearTimeout(timer)
  }, [runDealer, tablePhase, tableRound])

  return <section className="blackjack-card" dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-label={t('21 点 · 黑杰克', 'Blackjack · 21')}>
    <header className="bj-header">
      <div className="bj-brand">
        <span className="bj-logo" aria-hidden="true"><i>♠</i></span>
        <span><strong>{t('21 点 · 黑杰克', 'Blackjack')}</strong></span>
      </div>
      <div className="bj-header-tools">
        <BlackjackPoints points={starPoints} />
        <span className={`bj-round-pill${room.state.phase === 'players' ? ' is-live' : ''}`}><i />{room.state.phase === 'lobby' ? t('等待开局', 'OPEN') : t('第{{round}}局', 'ROUND {{round}}').replace('{{round}}', String(room.state.round))}</span>
        <button type="button" className={`bj-sound-button${sound ? ' is-on' : ''}`} onClick={toggle} aria-pressed={sound} aria-label={sound ? t('关闭音效', 'Turn sound effects off') : t('开启音效', 'Turn sound effects on')}><SoundIcon enabled={sound} /></button>
      </div>
    </header>
    <BlackjackTable state={room.state} />
    <BlackjackControls
      state={room.state}
      instanceId={instanceId}
      selfId={room.selfId}
      starPoints={starPoints}
      bet={selectedBet}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      onBetChange={changeBet}
      onPlay={() => room.play(selectedBet)}
      onAction={playAction}
      onRematch={rematch}
      onLeave={requestLeave}
    />
    {roundToast && <div className={`bj-round-toast is-${roundToast.outcome}`} role="status" aria-live="polite">
      <span className="bj-toast-spark" aria-hidden="true">✦</span>
      <strong>{roundToast.outcome === 'win' ? t('恭喜获胜！', 'YOU WIN') : roundToast.outcome === 'push' ? t('平局', 'PUSH') : t('本局失利', 'ROUND LOST')}</strong>
      <b>{roundToast.net > 0 ? '+' : ''}{roundToast.net.toLocaleString()}</b>
      <small>{t('净得积分', 'NET POINTS')} · {t('派彩', 'PAYOUT')} {roundToast.payout.toLocaleString()}</small>
      <span className="bj-toast-spark" aria-hidden="true">✦</span>
    </div>}
    {leaveConfirmOpen && <BlackjackLeaveDialog
      inRound={room.state.phase === 'players' || room.state.phase === 'dealer'}
      onCancel={cancelLeave}
      onConfirm={confirmLeave}
    />}
  </section>
}
