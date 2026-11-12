import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../lib/i18n'
import { setPopoverOpen } from '../lib/popoverGuard'

interface Props {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function PollConfirmDialog({ open, onCancel, onConfirm }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setPopoverOpen(true)
    cancelRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      setPopoverOpen(false)
      previousFocus?.focus()
    }
  }, [open, onCancel])

  if (!open) return null
  return createPortal(
    <div
      className="poll-confirm-backdrop"
      onPointerDown={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onCancel()
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className="poll-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="poll-confirm-title"
        aria-describedby="poll-confirm-description"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="poll-confirm-title">{t('关闭这次投票？', 'Close this poll?')}</h3>
        <p id="poll-confirm-description">{t('关闭后，所有人都不能再投票。', 'Voting will be closed for everyone.')}</p>
        <div className="poll-confirm-actions">
          <button ref={cancelRef} type="button" className="poll-confirm-cancel" onClick={onCancel}>
            {t('继续投票', 'Keep voting')}
          </button>
          <button type="button" className="poll-confirm-submit" onClick={onConfirm}>
            {t('关闭投票', 'Close poll')}
          </button>
        </div>
      </div>
    </div>,
    document.querySelector('.app-shell') ?? document.body,
  )
}
