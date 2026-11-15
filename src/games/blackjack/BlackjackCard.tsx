import type { Card as PlayingCard } from './model'
import type { Card as SolitaireCard } from '../solitaire/model'
import CardArt from '../solitaire/CardArt'
import { t } from '../../lib/i18n'
import { cardLabel } from './model'

export default function BlackjackCard({ card, back = false, small = false }: { card?: PlayingCard; back?: boolean; small?: boolean }) {
  const artCard: SolitaireCard | undefined = card ? { ...card, faceUp: true } : undefined
  const label = card ? `${cardLabel(card)} ${card.suit}` : t('扑克牌', 'Playing card')
  return (
    <span className={`bj-card${back ? ' is-back' : ''}${small ? ' is-small' : ''}`} role="img" aria-label={back ? t('牌面朝下', 'Face-down card') : label}>
      {back
        ? <img src="/games/blackjack/card-back.png" alt="" draggable="false" />
        : artCard && <CardArt card={artCard} />}
      <span className="bj-card-glint" aria-hidden="true" />
    </span>
  )
}
