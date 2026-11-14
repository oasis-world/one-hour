import { useCallback, useEffect, useRef, useState } from 'react'
import type { Match3ToastData } from './match3ToastTypes'

type ToastContent = Omit<Match3ToastData, 'id'>

export function useMatch3Toast() {
  const [toast, setToast] = useState<Match3ToastData | null>(null)
  const nextId = useRef(0)
  const onDismiss = useRef<{ id: number; callback: () => void } | null>(null)
  const showToast = useCallback((content: ToastContent, afterDismiss?: () => void) => {
    const id = ++nextId.current
    onDismiss.current = afterDismiss ? { id, callback: afterDismiss } : null
    setToast({ ...content, id })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => {
      setToast((current) => current?.id === toast.id ? null : current)
      if (onDismiss.current?.id !== toast.id) return
      const callback = onDismiss.current.callback
      onDismiss.current = null
      callback()
    }, toast.kind === 'reward' || toast.kind === 'refresh' ? 1500 : 2200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  return { toast, showToast }
}
