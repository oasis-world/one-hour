import { useEffect, useState } from 'react'

export type ImageDisplayMode = 'cover' | 'contain'

const STORAGE_KEY = 'match3:image-display-v2'
const MODES: ImageDisplayMode[] = ['cover', 'contain']

export function useImageDisplayMode() {
  const [mode, setMode] = useState<ImageDisplayMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'cover' || stored === 'contain') return stored
    } catch { /* storage is optional */ }
    return 'cover'
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, mode) } catch { /* storage is optional */ }
  }, [mode])

  const cycleMode = () => {
    setMode((current) => MODES[(MODES.indexOf(current) + 1) % MODES.length])
  }

  return { mode, cycleMode }
}
