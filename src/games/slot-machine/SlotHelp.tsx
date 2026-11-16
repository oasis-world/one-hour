import { createPortal } from 'react-dom'
import type { RefObject } from 'react'
import { t } from '../../lib/i18n'
import { PAYOUTS, SYMBOLS } from './model'
import { slotText as s } from './slotText'
import type { SlotTheme } from './themes'
import { SEVEN_IMAGE } from './slotSound'

interface Props {
  dir: 'ltr' | 'rtl'
  theme: SlotTheme
  panelRef: RefObject<HTMLElement | null>
  onClose: () => void
}

export default function SlotHelp({ dir, theme, panelRef, onClose }: Props) {
  const symbolName = (symbol: (typeof SYMBOLS)[number]) => s(...theme.labels[symbol])
  return createPortal(
    <div className="slot-help-backdrop" role="presentation">
      <section ref={panelRef} className="slot-help-modal" dir={dir} role="dialog" aria-modal="true" aria-label={s('游戏说明', 'How to play')} onClick={(event) => event.stopPropagation()}>
        <header><strong>{s('游戏说明', 'How to play')}</strong><button type="button" aria-label={t('关闭', 'Close')} onClick={onClose}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></button></header>
        <p>{s('5 条固定赔付线 · 任意位置连续 3 个及以上相同符号即可中奖', '5 fixed paylines · 3+ matching symbols in a row win anywhere')}</p>
        <p>{s('每条赔付线都使用完整下注', 'Bet applies to each of the 5 lines')}</p>
        <p>{s('百搭可代替任何符号', 'Wild substitutes for any symbol')}</p>
        <p className="slot-free-note">ⓘ {s('消耗星星积分 · 不涉及真钱', 'Uses your star points · no real money')}</p>
        <p className="slot-free-note">🎁 {s('单次净收益超过 10 积分时，10% 会进入奖池，每 5 分钟随机派发给排行榜玩家', 'When a spin nets over 10 points, 10% feeds the jackpot, which is randomly paid to the leaderboard every 5 minutes')}</p>
        <div className="slot-paytable">
          <b>{s('赔付表', 'Pay table')}</b>
          <div className="slot-pay-head"><span /><span>{s('连续 3 个', '3 in a row')}</span><span>{s('连续 4 个', '4 in a row')}</span><span>{s('连续 5 个', '5 in a row')}</span></div>
          {SYMBOLS.map((symbol) => <div className="slot-pay-row" key={symbol}><span><i className="slot-pay-icon">{symbol === 'wild' ? <img src={SEVEN_IMAGE} alt="" /> : theme.art[symbol]}</i>{symbolName(symbol)}</span>{PAYOUTS[symbol].map((multiplier, index) => <b key={index}>{multiplier}×</b>)}</div>)}
          <small>{s('每条线奖金 = 单线下注 × 倍数', 'Payout per line = bet × multiplier')}</small>
        </div>
      </section>
    </div>,
    document.body,
  )
}
