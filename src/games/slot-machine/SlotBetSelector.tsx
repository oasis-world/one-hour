import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { setPopoverOpen, suppressNextClick } from '../../lib/popoverGuard'

const BETS = [1, 2, 5, 10, 20, 30]

interface Props {
  id: string
  label: string
  dir: 'ltr' | 'rtl'
  value: number
  disabled: boolean
  onChange: (bet: number) => void
}

interface Position { top: number; left: number; width: number }

export default function SlotBetSelector({ id, label, dir, value, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setPopoverOpen(true)
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      suppressNextClick()
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        rootRef.current?.querySelector('button')?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      setPopoverOpen(false)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const updatePosition = () => {
      const trigger = rootRef.current?.querySelector('button')
      const panel = panelRef.current
      if (!trigger || !panel) return
      const rect = trigger.getBoundingClientRect()
      const width = Math.min(136, window.innerWidth - 24)
      const desiredLeft = dir === 'rtl' ? rect.right - width : rect.left
      const left = Math.max(12, Math.min(desiredLeft, window.innerWidth - width - 12))
      const height = panel.getBoundingClientRect().height
      const below = window.innerHeight - rect.bottom - 12
      const top = below >= height || below >= rect.top - 24
        ? Math.min(rect.bottom + 7, window.innerHeight - height - 12)
        : Math.max(12, rect.top - height - 7)
      setPosition({ top, left, width })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [dir, open])

  const choose = (bet: number) => {
    onChange(bet)
    setOpen(false)
  }

  return <div className="slot-bet-selector" ref={rootRef} onClick={(event) => event.stopPropagation()}>
    <label htmlFor={id}>{label}</label>
    <button
      id={id}
      type="button"
      className="slot-bet-trigger"
      aria-label={`${label}: ${value}`}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={`${id}-options`}
      disabled={disabled}
      onClick={() => setOpen((current) => !current)}
      onKeyDown={(event) => {
        if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault()
          setOpen(true)
        }
      }}
    >
      <span>{value}</span><span className="slot-bet-chevron" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg></span>
    </button>
    {open && createPortal(<div
      id={`${id}-options`}
      ref={panelRef}
      className="slot-bet-options"
      role="listbox"
      aria-label={label}
      dir={dir}
      style={{ top: position?.top ?? 0, left: position?.left ?? 0, width: position?.width ?? 136, visibility: position ? 'visible' : 'hidden' }}
    >
      {BETS.map((bet) => <button
        key={bet}
        type="button"
        role="option"
        aria-selected={value === bet}
        className={`slot-bet-option${value === bet ? ' is-selected' : ''}`}
        onClick={() => choose(bet)}
      >{bet}</button>)}
    </div>, document.body)}
  </div>
}
