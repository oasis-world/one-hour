import { useId } from 'react'
import type { GameDefinition } from '../games/types'
import { t } from '../lib/i18n'

const MEDALS: Record<number, { base: string; light: string; dark: string; star: string }> = {
  1: { base: '#f6c445', light: '#ffeaa6', dark: '#a3680a', star: '#fff7da' },
  2: { base: '#d0dae6', light: '#f6f9fd', dark: '#6d7d92', star: '#ffffff' },
  3: { base: '#cf855a', light: '#f2b990', dark: '#83431f', star: '#ffe8d3' },
}

function ChampionMedal({ rank }: { rank: number }) {
  const uid = useId().replace(/:/g, '')
  const c = MEDALS[rank] ?? MEDALS[3]
  const star = 'M20 16 L21.8 20.6 L26.7 20.8 L22.9 23.9 L24.1 28.7 L20 26 L15.9 28.7 L17.1 23.9 L13.3 20.8 L18.2 20.6 Z'
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <radialGradient id={`medal-${uid}`} cx="34%" cy="28%" r="78%">
          <stop offset="0%" stopColor={c.light} />
          <stop offset="55%" stopColor={c.base} />
          <stop offset="100%" stopColor={c.dark} />
        </radialGradient>
      </defs>
      {/* ribbons peeking out behind the disc */}
      <path d="M10 2 L15 2 L19 15 L14 15 Z" fill={c.dark} />
      <path d="M25 2 L30 2 L26 15 L21 15 Z" fill={c.dark} />
      <path d="M11.5 2 L13.5 2 L17 14 L15 14 Z" fill={c.base} opacity=".75" />
      <path d="M26.5 2 L28.5 2 L25 14 L23 14 Z" fill={c.base} opacity=".75" />
      {/* round metallic disc */}
      <circle cx="20" cy="23" r="14" fill={`url(#medal-${uid})`} stroke={c.dark} strokeWidth="1.2" />
      <circle cx="20" cy="23" r="10.5" fill="none" stroke={c.light} strokeWidth="1.3" opacity=".85" />
      {/* gloss */}
      <path d="M11 19 A 9 9 0 0 1 18 14" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".45" />
      {/* star, no number */}
      <path d={star} fill={c.star} stroke={c.dark} strokeWidth=".6" strokeLinejoin="round" />
    </svg>
  )
}

export default function GamePopularityIcon({
  game,
  count,
  rank,
  compact = false,
}: {
  game: GameDefinition
  count?: number
  rank?: number | null
  compact?: boolean
}) {
  const Icon = game.Icon
  const name = t(game.name, game.nameEn)
  const label = count === undefined ? name : `${name}: ${count}`
  return (
    <span className={`game-popularity-icon${compact ? ' is-compact' : ''}`} role="img" aria-label={label} title={label}>
      <span className="game-picker-icon" aria-hidden="true">
        {Icon ? <Icon size={compact ? 36 : 40} /> : <span className={`game-picker-emoji${game.id === 'blackjack' ? ' is-blackjack' : ''}`}>{game.icon}</span>}
      </span>
      {rank && rank <= 3 ? (
        <span className={`game-popularity-badge is-rank rank-${rank}`} aria-label={`Rank ${rank}`}><ChampionMedal rank={rank} /></span>
      ) : count !== undefined ? (
        <span className="game-popularity-badge is-count" aria-hidden="true">{count.toLocaleString()}</span>
      ) : null}
    </span>
  )
}
