import { useState } from 'react'
import { t } from '../../lib/i18n'
import { handValue, type BlackjackState } from './model'
import SlotBetSelector from '../slot-machine/SlotBetSelector'

const RULE_TIPS: Array<[string, string]> = [
  ['庄家未满 17 点必须补牌，17 点即停', 'Dealer must draw below 17 and stands on all 17s'],
  ['黑杰克（首两张 21 点）赔付 3:2', 'Blackjack pays 3:2'],
  ['首两张牌可加倍：注金翻倍，只再要一张', 'Double on your first two cards for one card only'],
  ['超过 21 点即爆牌，注金归庄家', 'Going over 21 is a bust'],
  ['A 可计为 1 或 11 点', 'An Ace counts as 1 or 11'],
  ['与庄家同点为平局，退回注金', 'A push returns your bet'],
]

interface Props {
  state: BlackjackState
  instanceId: string
  selfId: string | null
  starPoints: number
  canRematch: boolean
  bet: number
  dir: 'ltr' | 'rtl'
  onBetChange: (bet: number) => void
  onPlay: () => void
  onAction: (action: 'hit' | 'stand' | 'double') => void
  onRematch: () => void
  onLeave: () => void
}

export default function BlackjackControls({ state, instanceId, selfId, starPoints, canRematch, bet, dir, onBetChange, onPlay, onAction, onRematch, onLeave }: Props) {
  const player = state.players[0]
  const activeHand = player?.hands[0]
  const handStood = Boolean(activeHand?.stood)
  const activeScore = activeHand ? handValue(activeHand.cards).total : 0
  const canAddWager = Boolean(activeHand && starPoints >= activeHand.bet * 2)
  const canStartHand = starPoints >= bet
  const leaveButton = <button className="bj-action bj-leave-button" type="button" onClick={onLeave}>{t('离开', 'LEAVE')}</button>
  // Fixed hint slot: when no formal notice applies, show a random house rule
  // so the row above the buttons never collapses mid-round.
  const [tipIndex] = useState(() => Math.floor(Math.random() * RULE_TIPS.length))
  const [tipZh, tipEn] = RULE_TIPS[tipIndex] ?? RULE_TIPS[0]
  const tipRow = <p className="bj-connection bj-tip"><span className="bj-tip-tag">{t('规则', 'RULES')}</span><span>{t(tipZh, tipEn)}</span></p>
  const lobbyNote = !selfId
    ? { text: t('登录后即可加入牌桌', 'Sign in to join the table'), warn: false }
    : starPoints < bet
      ? { text: t('星星积分不足，下注金额不够', 'Not enough star points for this bet'), warn: true }
      : null

  if (state.phase === 'players') return <div className="bj-controls">
    <div className="bj-turn-label"><span className="bj-live-dot" />{t('轮到你了', 'YOUR TURN')}</div>
    <div className="bj-action-buttons">
      <button className="bj-action bj-hit" type="button" disabled={handStood} onClick={() => onAction('hit')}>{t('要牌', 'HIT')}</button>
      <button className="bj-action" type="button" disabled={handStood} onClick={() => onAction('stand')}>{t('停牌', 'STAND')}</button>
      <button className="bj-action" type="button" disabled={!activeHand || activeHand.cards.length !== 2 || activeHand.doubled || activeScore >= 21 || !canAddWager} onClick={() => onAction('double')}>{t('加倍', 'DOUBLE')}</button>
      {leaveButton}
    </div>
  </div>

  if (state.phase === 'dealer') return <div className="bj-controls bj-dealer-controls">
    <p className="bj-waiting-turn"><span className="bj-live-dot" />{t('庄家正在补牌…', 'The dealer is drawing…')}</p>
    <div className="bj-action-buttons">
      {leaveButton}
    </div>
  </div>

  if (state.phase === 'result') return <div className="bj-controls bj-result-controls">
    {tipRow}
    <div className="bj-action-buttons bj-result-actions">
      <div className="bj-result-wager">
        <SlotBetSelector
          id={`blackjack-bet-${instanceId}-result`}
          label={t('下注', 'BET')}
          dir={dir}
          value={bet}
          disabled={false}
          onChange={onBetChange}
          labelInside
        />
      </div>
      <button type="button" className="bj-action bj-hit" disabled={!canStartHand || !canRematch} onClick={onRematch}>{t('再来一局', 'DEAL AGAIN')}</button>{leaveButton}</div>
  </div>

  return <div className="bj-controls">
    {lobbyNote
      ? <p className={lobbyNote.warn ? 'bj-refill-note' : 'bj-connection'}>{lobbyNote.text}</p>
      : tipRow}
    <div className="bj-opening-actions">
      {selfId && <div className="bj-lobby-wager">
        <SlotBetSelector
          id={`blackjack-bet-${instanceId}`}
          label={t('下注', 'BET')}
          dir={dir}
          value={bet}
          disabled={false}
          onChange={onBetChange}
          labelInside
        />
      </div>}
      <button type="button" className="bj-deal-button" disabled={!canStartHand || !selfId} onClick={onPlay}>{t('和 AI 玩一局', 'PLAY A HAND VS AI')}</button>
    </div>
  </div>
}
