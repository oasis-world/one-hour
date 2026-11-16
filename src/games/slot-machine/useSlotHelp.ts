import { useEffect, useRef, useState } from 'react'
import { setPopoverOpen, suppressNextClick } from '../../lib/popoverGuard'

/** Help dialog state + outside-click/ESC handling via the shared popover guard. */
export function useSlotHelp() {
  const [helpOpen, setHelpOpen] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)
  const helpPanelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!helpOpen) return
    setPopoverOpen(true)
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (helpRef.current?.contains(target) || helpPanelRef.current?.contains(target)) return
      suppressNextClick()
      setHelpOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setHelpOpen(false) }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      setPopoverOpen(false)
    }
  }, [helpOpen])

  return { helpOpen, setHelpOpen, helpRef, helpPanelRef }
}
