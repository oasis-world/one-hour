import { useId } from 'react'
import type { CSSProperties } from 'react'
import { isRed, rankLabel, type Card } from './model'
import { SuitShape } from './SuitMark'

function SuitGlyph({ suit, x, y, size, rotated = false, color, className, style }: { suit: Card['suit']; x: number; y: number; size: number; rotated?: boolean; color: string; className?: string; style?: CSSProperties }) {
  return <svg className={className} style={style} x={x - size / 2} y={y - size / 2} width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
    <g transform={rotated ? 'rotate(180 12 12)' : undefined}><SuitShape suit={suit} /></g>
  </svg>
}

export default function CardArt({ card, back = false }: { card?: Card; back?: boolean }) {
  const patternId = `sol-card-back-${useId().replaceAll(':', '')}`
  if (back || !card) {
    return <svg className="sol-card-art sol-card-back-art" viewBox="0 0 70 98" aria-hidden="true">
      <rect x="1" y="1" width="68" height="96" rx="8" fill="#173b35" stroke="#d8c692" strokeWidth="2" />
      <rect x="5" y="5" width="60" height="88" rx="5" fill={`url(#${patternId})`} stroke="#d8c692" strokeWidth="1" />
      <defs><pattern id={patternId} width="9" height="9" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#1c5649"/><path d="M0 0h4v4H0z" fill="#d9bd76" opacity=".85"/><path d="M4 4h5v5H4z" fill="#d9bd76" opacity=".35"/></pattern></defs>
      <circle cx="35" cy="49" r="15" fill="#16483e" stroke="#e8d59d" strokeWidth="1.5"/><path d="m35 37 3.8 8.2 8.7 3.8-8.7 3.8L35 61l-3.8-7.2-8.7-3.8 8.7-3.8z" fill="#e8d59d"/>
    </svg>
  }
  const color = isRed(card.suit) ? '#bd3540' : '#202b32'
  const label = rankLabel(card.rank)
  const suitX = label === '10' ? 40 : 29
  const lowerRankX = label === '10' ? 16 : card.rank > 10 ? 12 : 11
  const court = card.rank > 10
  const pipRows: Record<number, [number, number][]> = {
    2: [[35, 30], [35, 68]], 3: [[35, 28], [35, 49], [35, 70]],
    4: [[24, 30], [46, 30], [24, 68], [46, 68]],
    5: [[24, 30], [46, 30], [35, 49], [24, 68], [46, 68]],
    6: [[24, 30], [46, 30], [24, 49], [46, 49], [24, 68], [46, 68]],
    7: [[24, 29], [46, 29], [35, 39], [24, 49], [46, 49], [24, 69], [46, 69]],
    8: [[24, 28], [46, 28], [24, 42], [46, 42], [24, 56], [46, 56], [24, 70], [46, 70]],
    9: [[24, 28], [46, 28], [24, 42], [46, 42], [35, 49], [24, 56], [46, 56], [24, 70], [46, 70]],
    10: [[24, 27], [46, 27], [24, 38], [46, 38], [24, 49], [46, 49], [24, 60], [46, 60], [24, 71], [46, 71]],
  }
  const pipSize: Record<number, number> = { 2: 27, 3: 22, 4: 22, 5: 21, 6: 20, 7: 19, 8: 16, 9: 15, 10: 14 }
  const pips = card.rank === 1 ? [] : (pipRows[card.rank] ?? []).map(([x, y]) => ({ x, y, rotated: y > 49 }))
  return <svg className="sol-card-art" viewBox="0 0 70 98" aria-hidden="true">
    <rect x="1" y="1" width="68" height="96" rx="8" fill="#fffdf7" stroke="#d7d4c9" strokeWidth="1.5" />
    <text className="sol-card-rank" x="7" y="15" fill={color} fontSize="20" fontWeight="800" fontFamily="Georgia,serif">{label}</text>
    <SuitGlyph className="sol-card-rank-suit" suit={card.suit} x={suitX} y={9} size={12} color={color} />
    <g transform="rotate(180 35 49)" fill={color} fontFamily="Georgia,serif" textAnchor="middle">
      <text className="sol-card-rank" x={lowerRankX} y="15" fontSize="20" fontWeight="800">{label}</text>
      <SuitGlyph className="sol-card-rank-suit" suit={card.suit} x={suitX} y={9} size={12} color={color} />
    </g>
    {court ? <g>
      <rect x="17" y="23" width="36" height="52" rx="14" fill={card.rank === 11 ? '#e8d9b6' : card.rank === 12 ? '#e9c8c3' : '#e6d28f'} stroke={color} strokeWidth="1.4" />
      <path d="M19 38 35 29l16 9-5 23-11 9-11-9z" fill={color} opacity=".92" />
      <path d="m35 32 7 8-7 8-7-8z" fill="#f4e5bd" stroke={color} strokeWidth="1" />
      <circle cx="35" cy="39" r="4" fill="#f4e5bd" />
      <path d="M29 47h12l5 9-11 8-11-8z" fill={card.rank === 11 ? '#4d8e80' : card.rank === 12 ? '#a64f55' : '#416d7b'} stroke="#fff7df" strokeWidth="1" />
      <SuitGlyph suit={card.suit} x={35} y={56} size={11} color="#fff8e4" />
      <path d="M22 28h26M22 70h26" stroke={color} strokeWidth="1" opacity=".6" />
    </g> : <g fill={color} textAnchor="middle" fontFamily="Georgia,serif">
      {card.rank === 1 ? <SuitGlyph className="sol-card-center-pip" style={{ '--sol-pip-mobile-scale': (40 - 4) / 40 } as CSSProperties} suit={card.suit} x={35} y={49} size={40} color={color} /> : pips.map((pip, index) => {
        const size = pipSize[card.rank] ?? 16
        return <SuitGlyph className="sol-card-center-pip" style={{ '--sol-pip-mobile-scale': (size - 4) / size } as CSSProperties} key={index} suit={card.suit} x={pip.x} y={pip.y} size={size} rotated={pip.rotated} color={color} />
      })}
    </g>}
  </svg>
}
