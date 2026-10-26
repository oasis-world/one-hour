import type { ReactNode } from 'react'
import { starPoints } from './star'

const FRAME = {
  width: '100%',
  height: '100%',
  display: 'block',
} as const

/** United States: 13 stripes, 7 of them under a 50-star canton. */
export default function UsFlag() {
  const stripe = 20 / 13
  const cantonW = 15.2
  const cantonH = stripe * 7
  const stripes: ReactNode[] = []
  for (let i = 0; i < 13; i += 2) {
    stripes.push(
      <rect key={`s${i}`} x="0" y={i * stripe} width="30" height={stripe} fill="#b22234" />,
    )
  }
  const stars: ReactNode[] = []
  for (let row = 0; row < 9; row++) {
    // Six stars on the odd rows (offset by half a slot), five on the even.
    const cols = row % 2 === 0 ? 6 : 5
    const y = ((row + 1) * cantonH) / 10
    for (let col = 0; col < cols; col++) {
      const slot = row % 2 === 0 ? col * 2 + 1 : col * 2 + 2
      const x = (slot * cantonW) / 12
      stars.push(
        <polygon key={`q${row}-${col}`} points={starPoints(x, y, 0.5)} fill="#ffffff" />,
      )
    }
  }
  return (
    <svg viewBox="0 0 30 20" style={FRAME} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="30" height="20" fill="#ffffff" />
      {stripes}
      <rect width={cantonW} height={cantonH} fill="#3c3b6e" />
      {stars}
    </svg>
  )
}
