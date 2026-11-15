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
import { BASE_BET } from './model'
import './BlackjackGame.css'

type RoundToast = { outcome: 'win' | 'push' | 'lose'; net: number; payout: number; stake: number }

function SoundIcon({ enabled }: { enabled: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9v6h4l5 4V5L8 9H4Z" />
    {enabled ? <><path d="M16 9a5 5 0 0 1 0 6" /><path d="M18.5 6.5a8.5 8.5 0 0 1 0 11" /></> : <path d="m5 5 14 14" />}
  </svg>
}

export default function BlackjackGame({ instanceId, hostUserId }: GameComponentProps) {
  const lang = useLang()
  const room = useBlackjackRoom(instanceId, hostUserId)
  const { isOwnTabAuthority, leave: leaveRoom, rematch: rematchRoom } = room
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
  const myPlayer = room.state.players.find((player) => player.userId === room.selfId)
  const myBet = myPlayer?.bet ?? selectedBet
  const changeBet = (bet: number) => {
    if (bet !== myBet) blackjackSound(instanceId, 'chip')
    setSelectedBet(bet)
    if (myPlayer) room.setBet(bet)
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
    leaveRoom()
  }, [leaveRoom])
  const rematch = useCallback(() => {
    setRoundToast(null)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    rematchRoom()
  }, [rematchRoom])

  useEffect(() => {
    if (room.state.round && room.state.round !== recordedRound.current && room.state.players.some((player) => player.userId === room.selfId)) {
      recordGamePlayed('blackjack', `${instanceId}:${room.state.round}`)
      recordedRound.current = room.state.round
    }
  }, [instanceId, room.selfId, room.state.round, room.state.players])

  useEffect(() => {
    if (!room.selfId || !room.state.round || !isOwnTabAuthority()) return
    const player = room.state.players.find((entry) => entry.userId === room.selfId)
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
      try { localStorage.setItem(key, JSON.stringify({ debited: stake, settled: true })) } catch { /* Best effort duplicate guard. */ }
      if (balanceDelta) adjustStarPoints(balanceDelta, true)
      recordGamePoints(payout - stake)
      return
    }
    const additionalStake = stake - ledger.debited
    if (additionalStake <= 0) return
    pointsLedger.current = { key, debited: stake, settled: false }
    try { localStorage.setItem(key, JSON.stringify({ debited: stake, settled: false })) } catch { /* Best effort duplicate guard. */ }
    adjustStarPoints(-additionalStake, true)
  }, [instanceId, isOwnTabAuthority, room.selfId, room.state])

  useEffect(() => {
    if (room.state.phase === 'lobby') return
    if (lastDeckCount.current !== room.state.deck.length) {
      blackjackSound(instanceId, 'deal')
      lastDeckCount.current = room.state.deck.length
    }
  }, [instanceId, room.selfId, room.state])

  useEffect(() => {
    if (room.state.phase !== 'result' || !room.selfId || room.state.round === toastedRound.current) return
    const player = room.state.players.find((entry) => entry.userId === room.selfId)
    if (!player) return
    toastedRound.current = room.state.round
    const payout = player.hands.reduce((sum, hand) => sum + hand.payout, 0)
    const stake = player.hands.reduce((sum, hand) => sum + hand.bet, 0)
    const net = payout - stake
    const outcome = net > 0 ? 'win' : net === 0 ? 'push' : 'lose'
    const nextToast: RoundToast = { outcome, net, payout, stake }
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => {
      setRoundToast(nextToast)
      toastTimer.current = window.setTimeout(() => setRoundToast(null), 3500)
    }, 0)
    blackjackSound(instanceId, net >= 0 ? 'win' : 'lose')
  }, [instanceId, room.selfId, room.state])

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
  }, [])

  useEffect(() => {
    if (room.state.phase !== 'dealer' || room.state.dealerId !== 'ai' || room.selfId !== room.state.leaderId) return
    const timer = window.setTimeout(room.finishAi, 650)
    return () => window.clearTimeout(timer)
  }, [room.finishAi, room.selfId, room.state.dealerId, room.state.leaderId, room.state.phase, room.state.round])

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
    <BlackjackTable state={room.state} selfId={room.selfId} />
    <BlackjackControls
      state={room.state}
      instanceId={instanceId}
      selfId={room.selfId}
      starPoints={starPoints}
      bet={myBet}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      ready={room.ready}
      onJoin={() => room.join(myBet)}
      onBetChange={changeBet}
      onQuickPlay={() => room.quickPlay(myBet)}
      onDealer={room.setDealer}
      onStart={room.start}
      onAction={playAction}
      onFinishDealer={room.finishDealer}
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
