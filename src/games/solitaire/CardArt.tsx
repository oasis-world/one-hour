import type { Card } from './model'

const SUIT_FILE: Record<Card['suit'], string> = {
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

export default function CardArt({ card, back = false }: { card?: Card; back?: boolean }) {
  if (back || !card) {
    return <img className="sol-card-art" src="/games/blackjack/cards-cc0/card-back-blue.svg" alt="" draggable="false" aria-hidden="true" />
  }
  const src = `/games/blackjack/cards-cc0/${rankFile(card.rank)}-${SUIT_FILE[card.suit]}.svg`
  return <img className="sol-card-art" src={src} alt="" draggable="false" aria-hidden="true" />
}
