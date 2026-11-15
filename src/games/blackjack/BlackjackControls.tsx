import { t } from '../../lib/i18n'
import { handValue, type BlackjackState } from './model'
import SlotBetSelector from '../slot-machine/SlotBetSelector'

interface Props {
  state: BlackjackState
  instanceId: string
  selfId: string | null
  starPoints: number
  bet: number
  dir: 'ltr' | 'rtl'
  ready: boolean
  onJoin: () => void
  onBetChange: (bet: number) => void
  onQuickPlay: () => void
  onDealer: (id: string | 'ai') => void
  onStart: () => void
  onAction: (action: 'hit' | 'stand' | 'double') => void
  onFinishDealer: () => void
  onRematch: () => void
  onLeave: () => void
}

export default function BlackjackControls({ state, instanceId, selfId, starPoints, bet, dir, ready, onJoin, onBetChange, onQuickPlay, onDealer, onStart, onAction, onFinishDealer, onRematch, onLeave }: Props) {
  const isPlayer = state.players.some((player) => player.userId === selfId)
  const isDealer = state.dealerId === selfId
  const myBet = state.players.find((player) => player.userId === selfId)?.bet ?? bet
  const activePlayer = state.players[state.activePlayer]
  const activeHand = activePlayer?.hands[state.activeHand]
  const canAct = ready && state.phase === 'players' && activePlayer?.userId === selfId && Boolean(activeHand)
  const activeScore = activeHand ? handValue(activeHand.cards).total : 0
  const canAddWager = Boolean(activeHand && starPoints >= activeHand.bet)
  const canStartHand = ready && starPoints >= myBet
  const leaveButton = <button className="bj-action bj-leave-button" type="button" disabled={!ready} onClick={onLeave}>{t('离开', 'LEAVE')}</button>
  const handIndicator = t('第{{hand}}手 · {{score}}点', 'HAND {{hand}} · {{score}}')
    .replace('{{hand}}', String(state.activeHand + 1)).replace('{{score}}', String(activeScore))

  if (state.phase === 'players') return <div className="bj-controls">
    {canAct ? <>
      <div className="bj-turn-label"><span className="bj-live-dot" />{t('轮到你了', 'YOUR TURN')}<small className="bj-hand-indicator">{handIndicator}</small></div>
      <div className="bj-action-buttons">
        <button className="bj-action bj-hit" type="button" onClick={() => onAction('hit')}>{t('要牌', 'HIT')}</button>
        <button className="bj-action" type="button" onClick={() => onAction('stand')}>{t('停牌', 'STAND')}</button>
        <button className="bj-action" type="button" disabled={!activeHand || activeHand.cards.length !== 2 || activeHand.doubled || activeScore >= 21 || !canAddWager} onClick={() => onAction('double')}>{t('加倍', 'DOUBLE')}</button>
        {(isPlayer || isDealer) && leaveButton}
      </div>
    </> : <div className="bj-waiting-turn"><span className="bj-live-dot" />{t('等待玩家完成手牌…', 'Waiting for the players to finish…')}</div>}
    {!canAct && (isPlayer || isDealer) && <div className="bj-action-buttons">{leaveButton}</div>}
  </div>

  if (state.phase === 'dealer') return <div className="bj-controls bj-dealer-controls">
    {isDealer
      ? <div className="bj-turn-label"><span className="bj-live-dot" />{t('庄家回合', "DEALER'S TURN")}<small>{t('庄家需抽牌至 17 点', 'Draw until you reach 17')}</small></div>
      : <p className="bj-waiting-turn"><span className="bj-live-dot" />{t('庄家正在完成手牌…', 'The dealer is finishing their hand…')}</p>}
    {(isPlayer || isDealer) && <div className="bj-action-buttons">
      {isDealer && <button className="bj-action bj-hit" type="button" disabled={!ready} onClick={onFinishDealer}>{t('亮庄完成', 'REVEAL')}</button>}
      {leaveButton}
    </div>}
  </div>

  if (state.phase === 'result') return <div className="bj-controls bj-result-controls">
    <div className="bj-result-summary"><span className="bj-result-spark">✦</span><span>{t('本局已结算', 'ROUND COMPLETE')}<small>{t('平局退回下注 · Blackjack 赔付 3:2', 'Push returns your bet · Blackjack pays 3:2')}</small></span></div>
    <div className="bj-action-buttons bj-result-actions"><button type="button" className="bj-action bj-hit" disabled={!ready} onClick={onRematch}>{t('再来一局', 'DEAL AGAIN')}</button>{(isPlayer || isDealer) && leaveButton}</div>
  </div>

  return <div className="bj-controls">
    {selfId && !isDealer && <div className="bj-lobby-wager">
      <SlotBetSelector
        id={`blackjack-bet-${instanceId}`}
        label={t('下注', 'BET')}
        dir={dir}
        value={myBet}
        disabled={!ready}
        onChange={onBetChange}
      />
      <span className="bj-lobby-balance"><i aria-hidden="true">✦</i><strong>{starPoints.toLocaleString()}</strong></span>
    </div>}
    {!ready && <p className="bj-connection">{t('正在连接牌桌…', 'Connecting to the table…')}</p>}
    {!selfId && <p className="bj-connection">{t('登录后即可加入牌桌', 'Sign in to join the table')}</p>}
    {selfId && state.dealerId === null && state.players.length === 0 && starPoints < bet && <p className="bj-refill-note">{t('星星积分不足，下注金额不够', 'Not enough star points for this bet')}</p>}
    {state.dealerId === null && state.players.length === 0 && <>
      <div className="bj-opening-actions">
         <button type="button" className="bj-deal-button" disabled={!ready || !selfId || starPoints < bet} onClick={onQuickPlay}>{t('和 AI 玩一局', 'PLAY A HAND VS AI')}</button>
        <button type="button" className="bj-secondary-button" disabled={!ready || !selfId} onClick={() => onDealer(selfId ?? '')}>{t('成为真人庄家', 'BECOME THE DEALER')}</button>
      </div>
    </>}
    {state.dealerId === null && state.players.length > 0 && <div className="bj-action-buttons">
      {!isPlayer && <button type="button" className="bj-action bj-hit" disabled={!ready || !selfId} onClick={() => onDealer(selfId ?? '')}>{t('成为真人庄家', 'BECOME THE DEALER')}</button>}
      {isPlayer && leaveButton}
    </div>}
    {state.dealerId !== null && (isPlayer || isDealer || (!isPlayer && !isDealer && state.players.length < 4)) && <div className="bj-action-buttons">
      {!isPlayer && !isDealer && <button type="button" className="bj-action bj-hit" disabled={!ready || !selfId} onClick={onJoin}>{t('加入牌桌', 'TAKE A SEAT')}</button>}
      {isPlayer && <button type="button" className="bj-action bj-hit" disabled={!canStartHand} onClick={onStart}>{t('开始发牌', 'DEAL')}</button>}
      {isDealer && state.players.length > 0 && <button type="button" className="bj-action bj-hit" disabled={!ready} onClick={onStart}>{t('开始发牌', 'DEAL')}</button>}
      {(isPlayer || isDealer) && leaveButton}
    </div>}
    {state.players.length >= 4 && !isPlayer && <p className="bj-connection">{t('牌桌已满 · 最多 4 位玩家', 'Table full · 4 players maximum')}</p>}
    {state.dealerId && !isDealer && state.players.length > 0 && !isPlayer && <p className="bj-connection">{t('正在等待开局', 'Waiting for the next deal')}</p>}
    {selfId && isPlayer && starPoints < myBet && <p className="bj-refill-note">{t('星星积分不足，下注金额不够', 'Not enough star points for this bet')}</p>}
  </div>
}
