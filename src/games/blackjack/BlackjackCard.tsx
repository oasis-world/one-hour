import type { Card as PlayingCard } from './model'
import { t } from '../../lib/i18n'
import { cardLabel } from './model'

const SUIT_FILE: Record<string, string> = {
  '♠': 'spades',
  '♥': 'hearts',
  '♦': 'diamonds',
  '♣': 'clubs',
}

function rankFile(rank: number): string {
  if (rank === 1) return 'ace'
  if (rank === 11) return 'jack'
  if (rank === 12) return 'queen'
  if (rank === 13) return 'king'
  return String(rank)
}

export default function BlackjackCard({ card, back = false }: { card?: PlayingCard; back?: boolean }) {
  const label = card ? `${cardLabel(card)} ${card.suit}` : t('扑克牌', 'Playing card')
  if (back || !card) {
    return (
      <span className={`bj-card${back ? ' is-back' : ''}`} role="img" aria-label={back ? t('牌面朝下', 'Face-down card') : label}>
        <img src="/games/blackjack/card-back.png" alt="" draggable="false" />
        <span className="bj-card-glint" aria-hidden="true" />
      </span>
    )
  }
  const src = `/games/blackjack/cards/${rankFile(card.rank)}-${SUIT_FILE[card.suit]}.svg`
  return (
    <span className="bj-card" role="img" aria-label={label}>
      <img src={src} alt="" draggable="false" />
      <span className="bj-card-glint" aria-hidden="true" />
    </span>
  )
}