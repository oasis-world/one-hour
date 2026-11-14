import { useCallback, useEffect, useRef, useState } from 'react'
import type { Match3ToastData } from './match3ToastTypes'

type ToastContent = Omit<Match3ToastData, 'id'>

export function useMatch3Toast() {
  const [toast, setToast] = useState<Match3ToastData | null>(null)
  const nextId = useRef(0)
  const showToast = useCallback((content: ToastContent) => {
    setToast({ ...content, id: ++nextId.current })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), toast.kind === 'reward' ? 1500 : 2200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  return { toast, showToast }
}
