import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GameComponentProps } from '../types'
import { t, useLang } from '../../lib/i18n'
import { setPopoverOpen, suppressNextClick } from '../../lib/popoverGuard'
import { adjustStarPoints, readStarPoints, subscribeStarPoints } from '../../lib/starPoints'
import { recordGamePoints } from '../../lib/lifetimeStats'
import { PAYLINES, PAYOUTS, randomGrid, readSave, scoreGrid, SYMBOLS, type ReelGrid, type SlotSave, type SymbolId } from './model'
import SlotBetSelector from './SlotBetSelector'
import { slotText as s } from './slotText'
import './SlotMachine.css'

const STORAGE = (id: string) => `slot-machine:${id}`
const ART: Record<SymbolId, string> = { cherry: '🍒', lemon: '🍋', orange: '🍊', grapes: '🍇', bell: '🔔', star: '⭐', diamond: '💎', wild: '' }
const SEVEN_IMAGE = '/games/slot-machine/lucky-seven.png'
const WIN_SOUND = '/games/slot-machine/magical-coin-win.mp3'
const SPIN_SYMBOLS: SymbolId[] = ['cherry', 'bell', 'lemon', 'star', 'orange', 'wild']
interface SpinResult { payout: number; net: number; wager: number }
let soundContext: AudioContext | null = null
const LABELS: Record<SymbolId, [string, string]> = {
  cherry: ['樱桃', 'Cherry'], lemon: ['柠檬', 'Lemon'], orange: ['橘子', 'Orange'], grapes: ['葡萄', 'Grapes'],
  bell: ['铃铛', 'Bell'], star: ['星星', 'Star'], diamond: ['钻石', 'Diamond'], wild: ['百搭', 'WILD'],
}

function getSoundContext(): AudioContext | null {
  try {
    if (!soundContext || soundContext.state === 'closed') soundContext = new AudioContext()
    if (soundContext.state === 'suspended') void soundContext.resume()
    return soundContext
  } catch { return null }
}

function playTone(context: AudioContext, frequency: number, start: number, duration: number, volume: number, type: OscillatorType, endFrequency?: number) {
  try {
    const oscillator = context.createOscillator(), gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration)
    gain.gain.setValueAtTime(.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + .012)
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(start); oscillator.stop(start + duration + .02)
  } catch { /* Audio is an optional enhancement. */ }
}

function playSpinSound() {
  const context = getSoundContext()
  if (!context) return
  const now = context.currentTime
  playTone(context, 145, now, .34, .035, 'sawtooth', 520)
  playTone(context, 270, now + .035, .25, .022, 'triangle', 710)
}

function playReelStopSound(index: number) {
  const context = getSoundContext()
  if (!context) return
  const now = context.currentTime, frequency = 660 + index * 82
  playTone(context, frequency, now, .075, .034, 'triangle')
  playTone(context, frequency * 2.4, now, .055, .012, 'sine')
}

function playSmallPayoutSound() {
  const context = getSoundContext()
  if (!context) return
  const now = context.currentTime
  playTone(context, 560, now, .13, .025, 'sine')
  playTone(context, 740, now + .11, .18, .025, 'sine')
}

function playWinFallback() {
  const context = getSoundContext()
  if (!context) return
  const now = context.currentTime
  ;[784, 988, 1175, 1568].forEach((frequency, index) => playTone(context, frequency, now + index * .11, .32, .05, 'sine'))
}

function playWinSound() {
  try {
    const audio = new Audio(WIN_SOUND)
    audio.volume = .55
    void audio.play().catch(playWinFallback)
  } catch { playWinFallback() }
}

function HelpIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.2" /><path d="M7.9 7.6a2.2 2.2 0 1 1 3.7 1.6c-.9.8-1.6 1.1-1.6 2.3" /><path d="M10 14.1v.1" /></svg>
}

function SoundIcon({ enabled }: { enabled: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" />{enabled ? <><path d="M16 9a5 5 0 0 1 0 6" /><path d="M18.5 6.5a8.5 8.5 0 0 1 0 11" /></> : <path className="slot-sound-slash" d="m5 5 14 14" />}</svg>
}

function JoystickIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v8" /><circle cx="12" cy="4.2" r="2.4" /><path d="M8 13h8l3.2 2.4a2.2 2.2 0 0 1-1.3 4H6.1a2.2 2.2 0 0 1-1.3-4L8 13Z" /><path d="M8 16.5h.1m7.8 0h.1" /></svg>
}

function SymbolArt({ symbol, className }: { symbol: SymbolId; className: string }) {
  return symbol === 'wild'
    ? <img className={`${className} slot-seven`} src={SEVEN_IMAGE} alt="" aria-hidden="true" />
    : <span className={className} aria-hidden="true">{ART[symbol]}</span>
}

export default function SlotMachine({ instanceId }: GameComponentProps) {
  const lang = useLang()
  const [save, setSave] = useState<SlotSave>(() => readSave(STORAGE(instanceId)))
  const [balance, setBalance] = useState(readStarPoints)
  const [reels, setReels] = useState<ReelGrid>(() => randomGrid())
  const [rolling, setRolling] = useState([false, false, false, false, false])
  const [wins, setWins] = useState<number[]>([])
  const [lastWin, setLastWin] = useState(0)
  const [toast, setToast] = useState<SpinResult | null>(null)
  const [sound, setSound] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)
  const helpPanelRef = useRef<HTMLElement>(null)
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
  useEffect(() => {
    if (!helpOpen) return
    setPopoverOpen(true)
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (helpRef.current?.contains(target) || helpPanelRef.current?.contains(target)) return
      suppressNextClick()
      setHelpOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setHelpOpen(false) }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      setPopoverOpen(false)
    }
  }, [helpOpen])

  const spin = () => {
    const totalWager = save.bet * PAYLINES.length
    if (rollingRef.current.some(Boolean) || balance < totalWager) return
    const outcome = randomGrid(), bet = save.bet
    adjustStarPoints(-totalWager, true)
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
        if (score.payout) adjustStarPoints(score.payout, true)
        recordGamePoints(score.payout - totalWager)
        setSave((current) => ({ ...current, bestWin: Math.max(current.bestWin, score.payout) }))
        const net = score.payout - totalWager
        setToast({ payout: score.payout, net, wager: totalWager })
        toastTimer.current = window.setTimeout(() => setToast(null), 5000)
        if (net > 0) {
          try { navigator.vibrate?.([24, 30, 55]) } catch { /* Haptics are optional. */ }
        }
        if (sound && net > 0) playWinSound()
        else if (sound && score.payout > 0) playSmallPayoutSound()
      }
    }, 620 + index * 260))
    if (sound) playSpinSound()
  }

  const busy = rolling.some(Boolean)
  const totalWager = save.bet * PAYLINES.length
  const symbolName = (symbol: SymbolId) => s(...LABELS[symbol])

  return <section className={`slot-card${helpOpen ? ' has-help-open' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-label={s('老虎机游戏', 'Slot Machine')}>
    <header className="slot-header">
      <div className="slot-brand"><span className="slot-logo"><img src={SEVEN_IMAGE} alt="" aria-hidden="true" /></span><span><strong>{s('老虎机', 'Slot Machine')}</strong><small>{s('经典水果 · 五轴', 'CLASSIC FRUIT · 5 REELS')}</small></span></div>
      <div className="slot-tools">
        <button type="button" className={`slot-icon-btn slot-sound${sound ? ' is-on' : ''}`} aria-pressed={sound} aria-label={sound ? s('关闭音效', 'Sound off') : s('开启音效', 'Sound on')} onClick={() => setSound((value) => !value)}><SoundIcon enabled={sound} /></button>
        <div className="slot-help-anchor" ref={helpRef}>
          <button type="button" className={`slot-icon-btn slot-help-trigger${helpOpen ? ' is-active' : ''}`} aria-label={s('游戏说明', 'How to play')} aria-haspopup="dialog" aria-expanded={helpOpen} onClick={() => setHelpOpen((open) => !open)}><HelpIcon /></button>
          {helpOpen && createPortal(<div className="slot-help-backdrop" role="presentation">
            <section ref={helpPanelRef} className="slot-help-modal" dir={lang === 'ar' ? 'rtl' : 'ltr'} role="dialog" aria-modal="true" aria-label={s('游戏说明', 'How to play')} onClick={(event) => event.stopPropagation()}>
              <header><strong>{s('游戏说明', 'How to play')}</strong><button type="button" aria-label={t('关闭', 'Close')} onClick={() => setHelpOpen(false)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></button></header>
              <p>{s('5 条固定赔付线 · 从左至右连线获胜', '5 fixed paylines · wins pay left to right')}</p>
              <p>{s('每条赔付线都使用完整下注', 'Bet applies to each of the 5 lines')}</p>
              <p>{s('百搭可代替任何符号', 'Wild substitutes for any symbol')}</p>
              <p className="slot-free-note">ⓘ {s('消耗星星积分 · 不涉及真钱', 'Uses your star points · no real money')}</p>
              <div className="slot-paytable">
                <b>{s('赔付表', 'Pay table')}</b>
                <div className="slot-pay-head"><span /><span>{s('连续 3 个', '3 in a row')}</span><span>{s('连续 4 个', '4 in a row')}</span><span>{s('连续 5 个', '5 in a row')}</span></div>
                {SYMBOLS.map((symbol) => <div className="slot-pay-row" key={symbol}><span><i className="slot-pay-icon">{symbol === 'wild' ? <img src={SEVEN_IMAGE} alt="" /> : ART[symbol]}</i>{symbolName(symbol)}</span>{PAYOUTS[symbol].map((multiplier, index) => <b key={index}>{multiplier}×</b>)}</div>)}
                <small>{s('每条线奖金 = 单线下注 × 倍数', 'Payout per line = bet × multiplier')}</small>
              </div>
            </section>
          </div>, document.body)}
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
              <SymbolArt symbol={symbol} className="slot-symbol" />
            </div>
          })}
          {rolling[column] && <div className="slot-spin-strip" aria-hidden="true"><div className="slot-spin-strip-track" style={{ animationDelay: `${-column * 0.045}s`, animationDuration: '.28s' }}>
            {Array.from({ length: 12 }, (_, index) => <SymbolArt key={index} symbol={SPIN_SYMBOLS[(index + column * 2) % SPIN_SYMBOLS.length]} className="slot-symbol" />)}
          </div></div>}
        </div>)}
        {toast !== null && <div className={`slot-win-toast${toast.net > 0 ? ' is-profit' : ''}`} role="status" aria-live="polite">
          {toast.net > 0 && <span className="slot-toast-spark">✦</span>}
          <strong>{toast.payout === 0 ? s('本次未中奖', 'No win this spin') : toast.net > 0 ? s('恭喜中奖！', 'Congratulations!') : s('派彩', 'Payout')}</strong>
          <b>{toast.payout > 0 ? '+' : '−'}{(toast.payout > 0 ? toast.payout : toast.wager).toLocaleString()}</b>
          <small>{s('净额', 'Net')} {toast.net > 0 ? '+' : ''}{toast.net.toLocaleString()}</small>
          {toast.net > 0 && <span className="slot-toast-spark">✦</span>}
        </div>}
      </div>
    </div>

    <div className="slot-controls">
      <SlotBetSelector id={`slot-bet-${instanceId}`} label={s('下注', 'Bet')} dir={lang === 'ar' ? 'rtl' : 'ltr'} value={save.bet} disabled={busy} onChange={(bet) => setSave((current) => ({ ...current, bet }))} />
      <button type="button" className="slot-spin" onClick={spin} disabled={busy || balance < totalWager}>
        <span className={`slot-joystick${busy ? ' is-moving' : ''}`}><JoystickIcon /></span>{busy ? s('旋转中', 'SPINNING') : s('旋转', 'SPIN')}
      </button>
    </div>

    {balance < totalWager && !busy && <p className="slot-refill-note">{s('请发送消息、图片、玩其它游戏来赚取积分', 'Send messages, photos, or play other games to earn points')}</p>}
  </section>
}
