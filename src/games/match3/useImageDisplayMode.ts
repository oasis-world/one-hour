import { useState } from 'react'

export type ImageDisplayMode = 'cover' | 'contain'

const MODES: ImageDisplayMode[] = ['cover', 'contain']

export function useImageDisplayMode() {
  const [mode, setMode] = useState<ImageDisplayMode>('cover')

  const cycleMode = () => {
    setMode((current) => MODES[(MODES.indexOf(current) + 1) % MODES.length])
  }

  return { mode, cycleMode }
}
