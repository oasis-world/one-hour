import { useEffect, useRef, useState } from 'react'
import type { GameComponentProps } from '../types'
import { useLang } from '../../lib/i18n'
import { useAccount } from '../../lib/useAccount'
import { resolveChatIdentity } from '../../lib/identity'
import { loadUserProfile } from '../../lib/userProfile'
import { adjustStarPoints, readStarPoints, subscribeStarPoints } from '../../lib/starPoints'
import { recordGamePlayed, recordGamePoints } from '../../lib/lifetimeStats'
import { jackpotContribution, PAYLINES, randomGrid, readSave, scoreGrid, type ReelGrid, type SlotSave, type SymbolId } from './model'
import { SLOT_THEMES, themeAt } from './themes'
import SlotBetSelector from './SlotBetSelector'
import SlotLeaderboard from './SlotLeaderboard'
import SlotHelp from './SlotHelp'
import { useSlotLeaderboard } from './useSlotLeaderboard'
import { useSlotJackpot } from './useSlotJackpot'
import { useSlotHelp } from './useSlotHelp'
import { slotText as s } from './slotText'
import { HelpIcon, JoystickIcon, ShuffleIcon, SoundIcon, SymbolArt } from './slotExtras'
import { playReelStopSound, playSmallPayoutSound, playSpinSound, playWinSound, SEVEN_IMAGE } from './slotSound'
import './SlotMachine.css'

const STORAGE = (id: string) => `slot-machine:${id}`
const SPIN_SYMBOLS: SymbolId[] = ['cherry', 'lemon', 'orange', 'grapes', 'bell', 'star', 'diamond', 'wild']
interface SpinResult { payout: number; net: number; wager: number; contribution: number }

export default function SlotMachine({ instanceId }: GameComponentProps) {
  const lang = useLang()
  const [save, setSave] = useState<SlotSave>(() => readSave(STORAGE(instanceId)))
  const theme = themeAt(save.theme)
  const cycleTheme = () => setSave((current) => ({ ...current, theme: (current.theme + 1) % SLOT_THEMES.length }))
  const [balance, setBalance] = useState(readStarPoints)
  const account = useAccount()
  const identity = resolveChatIdentity(account)
  const profile = loadUserProfile()
  const selfId = identity?.userId ?? null
  // The board is self-contained in the slot channel; each player's 1-hour
  // expiry rides in that same presence meta (no global-room dependency).
  const { players: lbPlayers, total: lbTotal, flashes: lbFlashes } = useSlotLeaderboard(instanceId, {
    userId: selfId,
    name: profile?.nickname ?? identity?.displayName ?? 'Player',
    score: save.score,
    spins: save.spins,
    avatarStyle: profile?.style ?? identity?.avatar?.style ?? null,
    avatarSeed: profile?.seed ?? identity?.avatar?.seed ?? null,
    avatarUrl: profile?.avatarUrl ?? identity?.avatarUrl ?? null,
    expiresAt: identity?.profileExpiresAt ?? null,
  })
  // Any player listed on this card can run the draw, so the jackpot keeps
  // paying out even after the card's sender has expired out of the room.
  const canRunDraw = lbPlayers.some((player) => player.isSelf)
  const jackpot = useSlotJackpot(instanceId, canRunDraw, lbPlayers, selfId)
  const [reels, setReels] = useState<ReelGrid>(() => randomGrid())
  const [rolling, setRolling] = useState([false, false, false, false, false])
  const [wins, setWins] = useState<number[]>([])
  const [lastWin, setLastWin] = useState(0)
  const [toast, setToast] = useState<SpinResult | null>(null)
  const [sound, setSound] = useState(false)
  const { helpOpen, setHelpOpen, helpRef, helpPanelRef } = useSlotHelp()
  const rollingRef = useRef([false, false, false, false, false])
  const timers = useRef<number[]>([])
  const toastTimer = useRef<number | null>(null)

  useEffect(() => {
    try { localStorage.setItem(STORAGE(instanceId), JSON.stringify(save)) } catch { /* Storage may be unavailable. */ }
  }, [instanceId, save])
  useEffect(() => subscribeStarPoints(setBalance), [])
  useEffect(() => () => {
    timers.current.forEach(window.clearTimeout)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
  }, [])

  const spin = () => {
    const totalWager = save.bet * PAYLINES.length
    if (rollingRef.current.some(Boolean) || balance < totalWager) return
    const outcome = randomGrid(), bet = save.bet, spinNumber = save.spins + 1
    recordGamePlayed('slot-machine', `${instanceId}:${spinNumber}`)
    setSave((current) => ({ ...current, spins: current.spins + 1 }))
    setLastWin(0); setWins([]); setToast(null)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    rollingRef.current = [true, true, true, true, true]
    setRolling([...rollingRef.current]); setReels(randomGrid())
    timers.current = Array.from({ length: 5 }, (_, index) => window.setTimeout(() => {
      rollingRef.current[index] = false
      setRolling([...rollingRef.current])
      setReels((current) => current.map((reel, column) => column === index ? outcome[column] : reel))
      if (sound) playReelStopSound(index)
      if (index === 4) {
        const score = scoreGrid(outcome, bet)
        setWins(score.wins.flatMap((win) => win.cells)); setLastWin(score.payout)
        const net = score.payout - totalWager
        const contribution = jackpotContribution(net)
        const credited = net - contribution
        if (credited) adjustStarPoints(credited, true)
        if (contribution > 0) {
          void jackpot.contribute(contribution, spinNumber, selfId ?? '').then((accepted) => {
            // If the pool is unavailable (e.g. the SQL migration was not run),
            // give the withheld slice back instead of silently losing points.
            if (accepted) return
            adjustStarPoints(contribution, true)
            recordGamePoints(contribution)
            setSave((current) => ({ ...current, score: current.score + contribution }))
            setToast((current) => current ? { ...current, contribution: 0 } : null)
          })
        }
        recordGamePoints(credited)
        setSave((current) => ({ ...current, bestWin: Math.max(current.bestWin, score.payout), score: current.score + credited }))
        setToast({ payout: score.payout, net, wager: totalWager, contribution })
        toastTimer.current = window.setTimeout(() => setToast(null), 3500)
        if (net > 0) { try { navigator.vibrate?.([24, 30, 55]) } catch { /* Haptics are optional. */ } }
        if (sound && net > 0) playWinSound()
        else if (sound && score.payout > 0) playSmallPayoutSound()
      }
    }, 620 + index * 260))
    if (sound) playSpinSound()
  }

  const busy = rolling.some(Boolean)
  const totalWager = save.bet * PAYLINES.length
  const symbolName = (symbol: SymbolId) => s(...theme.labels[symbol])

  return <><section className={`slot-card${helpOpen ? ' has-help-open' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-label={s('老虎机游戏', 'Slot Machine')}>
    <header className="slot-header">
      <div className="slot-brand"><span className="slot-logo"><img src={SEVEN_IMAGE} alt="" aria-hidden="true" /></span><span><strong>{s('老虎机', 'Slot Machine')}</strong><small>{s(...theme.name)} · {s('五轴', '5 REELS')}</small></span></div>
      <div className="slot-tools">
        <button type="button" className={`slot-icon-btn slot-sound${sound ? ' is-on' : ''}`} aria-pressed={sound} aria-label={sound ? s('关闭音效', 'Sound off') : s('开启音效', 'Sound on')} onClick={() => setSound((value) => !value)}><SoundIcon enabled={sound} /></button>
        <button type="button" className="slot-icon-btn slot-theme" aria-label={s('切换图案', 'Switch symbols')} title={`${s('切换图案', 'Switch symbols')}: ${s(...theme.name)}`} onClick={cycleTheme}><ShuffleIcon /></button>
        <div className="slot-help-anchor" ref={helpRef}>
          <button type="button" className={`slot-icon-btn slot-help-trigger${helpOpen ? ' is-active' : ''}`} aria-label={s('游戏说明', 'How to play')} aria-haspopup="dialog" aria-expanded={helpOpen} onClick={() => setHelpOpen((open) => !open)}><HelpIcon /></button>
          {helpOpen && <SlotHelp dir={lang === 'ar' ? 'rtl' : 'ltr'} theme={theme} panelRef={helpPanelRef} onClose={() => setHelpOpen(false)} />}
        </div>
      </div>
    </header>

    <div className="slot-stats">
      <div className="slot-stat"><small>{s('余额', 'BALANCE')}</small><strong>{balance.toLocaleString()}</strong></div>
      <div className="slot-stat"><small>{s('上次赢得', 'LAST WIN')}</small><strong className={lastWin ? 'has-win' : ''}>{lastWin.toLocaleString()}</strong></div>
      <div className="slot-stat"><small>{s('旋转次数', 'Spins')}</small><strong>{save.spins}</strong></div>
      <div className="slot-stat"><small>{s('最高奖金', 'Best win')}</small><strong>{save.bestWin.toLocaleString()}</strong></div>
    </div>

    <div className="slot-cabinet">
      <div className="slot-marquee"><span>✦</span><b>LUCKY&nbsp; SEVEN</b><span>✦</span></div>
      <div className="slot-reels" role="group" aria-label={s('五个转轴，三列符号', 'Five reels, three rows of symbols')}>
        {reels.map((reel, column) => <div className={`slot-reel${rolling[column] ? ' is-spinning' : ''}`} role="group" key={column} aria-label={`${s('转轴', 'Reel')} ${column + 1}`}>
          {reel.map((symbol, row) => {
            const cell = column * 3 + row
            return <div className={`slot-cell${wins.includes(cell) ? ' is-winning' : ''}${symbol === 'wild' ? ' is-wild' : ''}`} key={row} role="img" aria-label={symbolName(symbol)}>
              <SymbolArt symbol={symbol} className="slot-symbol" art={theme.art} />
            </div>
          })}
          {rolling[column] && <div className="slot-spin-strip" aria-hidden="true"><div className="slot-spin-strip-track" style={{ animationDelay: `${-column * 0.045}s`, animationDuration: '.28s' }}>
            {Array.from({ length: 12 }, (_, index) => <SymbolArt key={index} symbol={SPIN_SYMBOLS[(index + column * 2) % SPIN_SYMBOLS.length]} className="slot-symbol" art={theme.art} />)}
          </div></div>}
        </div>)}
        {toast !== null && <div className={`slot-win-toast${toast.net > 0 ? ' is-profit' : ''}`} role="status" aria-live="polite">
          {toast.net > 0 && <span className="slot-toast-spark">✦</span>}
          <strong>{toast.payout === 0 ? s('本次未中奖', 'No win this spin') : toast.net > 0 ? s('恭喜中奖！', 'Congratulations!') : s('派彩', 'Payout')}</strong>
          <b>{toast.payout > 0 ? '+' : '−'}{(toast.payout > 0 ? toast.payout : toast.wager).toLocaleString()}</b>
          <small>{s('净额', 'Net')} {toast.net > 0 ? '+' : ''}{toast.net.toLocaleString()}</small>
          {toast.contribution > 0 && <small className="slot-toast-jackpot">🎁 {s('奖池贡献', 'To jackpot')} −{toast.contribution.toLocaleString()} · {s('实际到手', 'You keep')} +{(toast.net - toast.contribution).toLocaleString()}</small>}
          {toast.net > 0 && <span className="slot-toast-spark">✦</span>}
        </div>}
      </div>
    </div>

    <div className="slot-controls">
      <SlotBetSelector id={`slot-bet-${instanceId}`} label={s('下注', 'Bet')} dir={lang === 'ar' ? 'rtl' : 'ltr'} value={save.bet} disabled={busy} onChange={(bet) => setSave((current) => ({ ...current, bet }))} labelInside />
      <button type="button" className="slot-spin" onClick={spin} disabled={busy || balance < totalWager}>
        <span className={`slot-joystick${busy ? ' is-moving' : ''}`}><JoystickIcon /></span>{busy ? s('旋转中', 'SPINNING') : s('旋转', 'SPIN')}
      </button>
    </div>

    {balance < totalWager && !busy && <p className="slot-refill-note">{s('请发送消息、图片、玩其它游戏来赚取积分', 'Send messages, photos, or play other games to earn points')}</p>}
    </section>

    <SlotLeaderboard players={lbPlayers} total={lbTotal} flashes={lbFlashes} dir={lang === 'ar' ? 'rtl' : 'ltr'} jackpot={{ pool: jackpot.state.pool, gainFlash: jackpot.gainFlash, payoutFlash: jackpot.payoutFlash, drawAt: jackpot.state.drawAt }} />
  </>
}
