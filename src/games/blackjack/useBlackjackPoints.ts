import { useEffect, useState } from 'react'
import { readStarPoints, subscribeStarPoints } from '../../lib/starPoints'

export function useBlackjackPoints() {
  const [points, setPoints] = useState(readStarPoints)
  useEffect(() => subscribeStarPoints(setPoints), [])
  return points
}
