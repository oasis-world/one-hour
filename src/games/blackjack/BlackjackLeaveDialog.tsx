import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../../lib/i18n'
import { setPopoverOpen, suppressNextClick } from '../../lib/popoverGuard'

interface Props {
  inRound: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function BlackjackLeaveDialog({ inRound, onCancel, onConfirm }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setPopoverOpen(true)
    cancelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      setPopoverOpen(false)
      previousFocus?.focus()
    }
  }, [onCancel])

  return createPortal(
    <div
      className="bj-leave-backdrop"
      onPointerDown={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) {
          suppressNextClick()
          onCancel()
        }
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <section className="bj-leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby="bj-leave-title">
        <span className="bj-leave-dialog-icon" aria-hidden="true">♠</span>
        <h2 id="bj-leave-title">{t('确定离开牌桌？', 'Leave this table?')}</h2>
        <p>{inRound
          ? t('离开后将退出当前牌局，当前下注会作废。', 'Leaving ends your participation in this hand; your active bet will be forfeited.')
          : t('你可以之后重新加入或开始新的牌局。', 'You can rejoin or start a new table later.')}</p>
        <div className="bj-leave-dialog-actions">
          <button ref={cancelRef} type="button" className="bj-leave-cancel" onClick={onCancel}>{t('继续游戏', 'STAY')}</button>
          <button type="button" className="bj-leave-confirm" onClick={onConfirm}>{t('离开牌桌', 'LEAVE TABLE')}</button>
        </div>
      </section>
    </div>,
    document.querySelector('.app-shell') ?? document.body,
  )
}
