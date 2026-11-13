import { useEffect, useRef, useState } from 'react'
import { setMatch3SoundEnabled } from './match3Sound'

export function useMatch3Sound(instanceId: string) {
  const [enabled, setEnabled] = useState(false)
  const enabledRef = useRef(false)

  useEffect(() => () => {
    enabledRef.current = false
    setMatch3SoundEnabled(instanceId, false)
  }, [instanceId])

  const toggle = () => {
    const next = !enabledRef.current
    enabledRef.current = next
    setEnabled(next)
    setMatch3SoundEnabled(instanceId, next)
  }

  return { enabled, enabledRef, toggle }
}
