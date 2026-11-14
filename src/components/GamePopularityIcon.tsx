import type { GameDefinition } from '../games/types'
import { t } from '../lib/i18n'

function ChampionTrophy({ rank }: { rank: number }) {
  const colors = rank === 1
    ? { cup: '#f8c542', shade: '#bd7b12', text: '#704300' }
    : rank === 2
      ? { cup: '#d8e1eb', shade: '#8190a3', text: '#43536a' }
      : { cup: '#cf815d', shade: '#8b4e34', text: '#60331f' }
  return (
    <svg viewBox="0 0 30 36" aria-hidden="true">
      <path d="M8 3h14v7c0 6-3 9-7 11-4-2-7-5-7-11V3Z" fill={colors.cup} stroke={colors.shade} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 7H3v3c0 4 2.5 6 6.5 7M22 7h5v3c0 4-2.5 6-6.5 7" fill="none" stroke={colors.shade} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M10 6h10" stroke="rgba(255,255,255,.62)" strokeWidth="1.5" strokeLinecap="round" />
      <text x="15" y="17" textAnchor="middle" fontSize="16" fontWeight="900" fill={colors.text}>{rank}</text>
      <path d="M15 21v5m-5 0h10m-8 0v3h6v-3m-10 6h14" fill="none" stroke={colors.shade} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
        {Icon ? <Icon size={compact ? 36 : 40} /> : <span className="game-picker-emoji">{game.icon}</span>}
      </span>
      {rank && rank <= 3 ? (
        <span className={`game-popularity-badge is-rank rank-${rank}`} aria-label={`Rank ${rank}`}><ChampionTrophy rank={rank} /></span>
      ) : count !== undefined ? (
        <span className="game-popularity-badge is-count" aria-hidden="true">{count.toLocaleString()}</span>
      ) : null}
    </span>
  )
}
