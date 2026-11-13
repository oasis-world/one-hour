import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { setPopoverOpen, suppressNextClick } from '../../lib/popoverGuard'
import { t, useLang } from '../../lib/i18n'
import { matchText as m } from './matchText'
import './Match3Game.css'

export default function Match3HelpDialog({ onClose }: { onClose: () => void }) {
  const lang = useLang()
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    setPopoverOpen(true)
    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return
      suppressNextClick()
      onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      setPopoverOpen(false)
    }
  }, [onClose])

  return createPortal(
    <div className="m3-help-backdrop" role="presentation">
      <section ref={panelRef} className="m3-help-modal" dir={lang === 'ar' ? 'rtl' : 'ltr'} role="dialog" aria-modal="true">
        <header>
          <strong>{m('游戏说明', 'How to play')}</strong>
          <button type="button" aria-label={t('关闭', 'Close')} onClick={onClose}>×</button>
        </header>
        <p>{m('点击两个相邻图块交换位置，横向或纵向连成 3 个及以上相同图块即可消除。', 'Tap two adjacent tiles to swap. Match 3 or more identical tiles in a row or column to clear them.')}</p>
        <p>{m('消除后上方图块下落并补充新图块，可能触发连鎖。', 'Tiles above fall to fill gaps and new tiles drop in, which may trigger cascades.')}</p>
        <p>{m('无可用移动时会自动重新洗牌。', 'The board reshuffles automatically when no moves remain.')}</p>
        <p className="m3-free-note">ⓘ {m('消耗星星积分 · 不涉及真钱', 'Uses your star points · no real money')}</p>
      </section>
    </div>,
    document.body,
  )
}
