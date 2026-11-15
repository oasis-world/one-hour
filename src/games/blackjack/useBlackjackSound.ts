import { useEffect, useRef, useState } from 'react'
import { setBlackjackSound, stopBlackjackSound } from './sound'

export function useBlackjackSound(instanceId: string) {
  const [sound, setSound] = useState(false)
  const enabled = useRef(false)
  useEffect(() => () => stopBlackjackSound(instanceId), [instanceId])
  const toggle = () => {
    enabled.current = !enabled.current
    setSound(enabled.current)
    setBlackjackSound(instanceId, enabled.current)
  }
  return { sound, toggle }
}
