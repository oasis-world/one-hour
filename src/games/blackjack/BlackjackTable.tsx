import AvatarBadge from '../../components/AvatarBadge'
import { t } from '../../lib/i18n'
import { cardLabel, handValue, type BlackjackState, type Hand, type Player } from './model'
import type { CSSProperties } from 'react'
import BlackjackCard from './BlackjackCard'
import './BlackjackTable.css'

function HandView({ hand, hidden, result, active = false, dealOrder = 0 }: { hand: Hand; hidden: boolean; result?: string; active?: boolean; dealOrder?: number }) {
  const score = handValue(hand.cards)
  const resultText: Record<string, string> = { win: t('获胜', 'WIN'), lose: t('落败', 'LOSE'), push: t('平局', 'PUSH'), bust: t('爆牌', 'BUST'), blackjack: t('黑杰克', 'BLACKJACK') }
  return <div className={`bj-hand${active ? ' is-current' : ''}${result ? ` is-${result}` : ''}`}>
    <div className="bj-hand-meta">
      <strong className="bj-score-pill">{hidden ? cardLabel(hand.cards[0]) : score.total}</strong>{!hidden && score.soft && <small>{t('软牌', 'SOFT')}</small>}
      {result && <span className="bj-hand-result">{resultText[result] ?? result}</span>}
      {hand.doubled && <small>{t('已加倍', 'DOUBLED')}</small>}
      {result && hand.payout > 0 && <small className="bj-payout">{result === 'push' ? `↩ ${hand.payout}` : `+${hand.payout - hand.bet}`}</small>}
    </div>
    <div className="bj-cards" aria-label={t('手牌', 'Hand')}>
      {hand.cards.map((card, index) => <span className="bj-card-stack" key={card.id} style={{ zIndex: index, animationDelay: `${Math.min(dealOrder + index, 8) * 85}ms` }}>
        <BlackjackCard card={card} back={hidden && index === 1} small={hand.cards.length > 4} />
      </span>)}
    </div>
  </div>
}

function PlayerSeat({ player, index, playerCount, active, activeHand, results, selfId }: { player: Player; index: number; playerCount: number; active: boolean; activeHand: number; results: BlackjackState['results']; selfId: string | null }) {
  const bet = player.hands.reduce((sum, hand) => sum + hand.bet, 0)
  return <article className={`bj-seat${active ? ' is-active' : ''}${player.userId === selfId ? ' is-self' : ''}`}>
    <div className="bj-seat-head">
      <AvatarBadge className="bj-avatar" size={42} look={{ style: player.avatarStyle || 'thumbs', seed: player.avatarSeed || player.userId, url: player.avatarUrl }} />
      <div className="bj-seat-name"><strong title={player.name}>{player.name}</strong></div>
    </div>
    {active && <span className="bj-active-arrow" aria-label={t('当前回合', 'Current turn')} />}
    <div
      className="bj-player-hands"
      style={{ '--bj-deal-x': `${(playerCount - 1) / 2 * 44 - index * 44}px`, '--bj-deal-y': '-112px' } as CSSProperties}
    >
      {player.hands.map((hand, handIndex) => <div className="bj-player-hand" key={`${player.userId}-${handIndex}`}>
        <HandView hand={hand} hidden={false} active={active && handIndex === activeHand} result={results[`${player.userId}:${handIndex}`]} dealOrder={Math.min(index * 2 + handIndex, 7)} />
      </div>)}
    </div>
    <div className="bj-stake-chip" aria-label={`${t('下注', 'BET')} ${bet} ${t('星星积分', 'STAR POINTS')}`}>
      <span className="bj-chip-stack"><i /><i /><b>{bet}</b></span>
      <small>✦ {bet}</small>
    </div>
  </article>
}

export default function BlackjackTable({ state, selfId }: { state: BlackjackState; selfId: string | null }) {
  const hideHoleCard = state.phase === 'players'
  const dealerVisible = hideHoleCard ? state.dealerHand.slice(0, 1) : state.dealerHand
  const dealerScore = handValue(dealerVisible)
  const activeUserId = state.players[state.activePlayer]?.userId
  const isAi = state.dealerId === 'ai'
  const dealerName = isAi ? t('AI 庄家', 'AI Dealer') : state.dealerName ?? t('庄家', 'Dealer')
  const avatarLook = { style: isAi ? 'thumbs' : 'thumbs', seed: state.dealerId ?? 'dealer', url: state.dealerAvatarUrl }
  const dealerImage = <AvatarBadge className={`bj-dealer-avatar${isAi ? ' is-ai' : ''}`} size={38} look={avatarLook} />
  return <div className="bj-table" aria-label={t('21 点 · 黑杰克', 'Blackjack table')}>
     <section className="bj-dealer-zone">
      <div className="bj-dealer-card">
        <div className="bj-dealer-heading">
          {dealerImage}
          <strong>{dealerName}</strong>
        </div>
        <div className="bj-dealer-hand">
          {state.dealerHand.length > 0 && <div className="bj-hand-meta"><strong className="bj-score-pill">{hideHoleCard ? dealerScore.total : handValue(state.dealerHand).total}</strong>{!hideHoleCard && handValue(state.dealerHand).soft && <small>{t('软牌', 'SOFT')}</small>}</div>}
          <div className="bj-cards" aria-label={t('庄家手牌', "Dealer's hand")}>
            {state.dealerHand.map((card, index) => <span className="bj-card-stack" key={card.id} style={{ zIndex: index, '--bj-deal-x': '38px', '--bj-deal-y': '70px', animationDelay: `${index * 100}ms` } as CSSProperties}>
              <BlackjackCard card={card} back={hideHoleCard && index === 1} />
            </span>)}
          </div>
        </div>
      </div>
      <div className="bj-dealer-shoe" aria-hidden="true">
        <span /><span /><span />
      </div>
    </section>
    <section className={`bj-seats${state.players.length > 2 ? ' has-many' : ''}`} data-count={state.players.length} aria-label={t('玩家座位', 'Player seats')}>
      {state.players.map((player, index) => <PlayerSeat
        key={player.userId}
        player={player}
        index={index}
        playerCount={state.players.length}
        selfId={selfId}
        active={state.phase === 'players' && activeUserId === player.userId}
        activeHand={state.activePlayer === index ? state.activeHand : -1}
        results={state.results}
      />)}
    </section>
  </div>
}
