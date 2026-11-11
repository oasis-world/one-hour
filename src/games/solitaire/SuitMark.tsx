import type { Suit } from './model'

export function SuitShape({ suit }: { suit: Suit }) {
  if (suit === '♥') return <path d="M12 21S2.5 15.1 2.5 8.4A5.4 5.4 0 0 1 12 4.8a5.4 5.4 0 0 1 9.5 3.6C21.5 15.1 12 21 12 21Z" />
  if (suit === '♦') return <path d="M12 1 23 12 12 23 1 12 12 1Z" />
  if (suit === '♣') return <g><circle cx="12" cy="7" r="5"/><circle cx="6.5" cy="13" r="5"/><circle cx="17.5" cy="13" r="5"/><path d="M10 14h4l-1.5 8h-3L10 14Z" /></g>
  return <path d="M12 2C10 5.1 2.5 9.4 2.5 14a5.4 5.4 0 0 0 9.5 3.6A5.4 5.4 0 0 0 21.5 14C21.5 9.4 14 5.1 12 2ZM10 15h4l1.5 7h-7L10 15Z" />
}

export default function SuitMark({ suit, size = 18, className }: { suit: Suit; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <SuitShape suit={suit} />
  </svg>
}
