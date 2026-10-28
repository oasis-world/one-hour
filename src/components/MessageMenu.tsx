import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ChatEntry } from '../lib/chatTypes'
import { t, useLang } from '../lib/i18n'
import { REACTION_PALETTE, getQuickEmojis } from '../lib/chatReactions'
import { ChevronRightIcon, CopyIcon, EditIcon, ReactIcon, ReplyIcon, TrashIcon } from './icons'

export interface MenuAnchor {
  x: number
  y: number
}

/** Widest the touch quick row ever renders before the fit pass trims it. */
const MAX_FIT = 12
/** Narrowest the row goes — hover-bar parity, never an empty row. */
const MIN_FIT = 4

interface Props {
  entry: ChatEntry
  mine: boolean
  anchor: MenuAnchor
  /** Mobile bottom sheet: centered above the safe area, not at the anchor. */
  sheet: boolean
  /** Open straight into the delete-confirmation view. */
  initialConfirm?: boolean
  onClose: () => void
  onReact: (emoji: string) => void
  onCopy: (entry: ChatEntry) => void
  onReply: (entry: ChatEntry) => void
  onEdit: (entry: ChatEntry) => void
  onDelete: (entry: ChatEntry) => void
}

/**
 * Discord-style right-click menu (oasis room pattern): single-line emoji
 * quick row on top, then an "Add Reaction" fold-out (chevron on the right,
 * rotates down when open), then the action items — Delete sits alone below
 * its own separator and appears only on the player's own messages. Closes
 * on outside pointerdown, Escape, window scroll — but never on scrolls
 * that start inside the menu itself (palette wheel-scroll).
 */
export default function MessageMenu({
  entry,
  mine,
  anchor,
  sheet,
  initialConfirm = false,
  onClose,
  onReact,
  onCopy,
  onReply,
  onEdit,
  onDelete,
}: Props) {
  useLang() // re-render on language flips
  const ref = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(anchor)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirming, setConfirming] = useState(initialConfirm)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  /**
   * Touch phones fill the quick row to the real screen width: start wide and
   * shrink until the single line fits (emoji cells are fixed 38px, so this
   * converges in a few passes). Desktops keep the fixed six.
   */
  const touchUI = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: none), (pointer: coarse)').matches,
    [],
  )
  const [fit, setFit] = useState(touchUI ? MAX_FIT : 6)
  useLayoutEffect(() => {
    const row = rowRef.current
    if (!touchUI || !row) return
    if (row.scrollWidth > row.clientWidth + 1 && fit > MIN_FIT) {
      setFit(fit - 1)
    }
  }, [touchUI, fit])

  useLayoutEffect(() => {
    if (sheet) return
    // Keep the menu inside the viewport at the anchor — and re-clamp when
    // the window resizes (embedded panes resize freely; closing on resize
    // would drop the menu on spurious 1px events).
    const clamp = () => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const margin = 8
      const bottomGap = touchUI ? 30 : 100
      const gap = touchUI ? 30 : 12
      let x = Math.max(margin, Math.min(anchor.x, window.innerWidth - rect.width - margin))
      let y = anchor.y
      if (y + rect.height > window.innerHeight - bottomGap) {
        y = window.innerHeight - rect.height - bottomGap
      }
      y = Math.max(margin, y)
      if (touchUI) {
        // Mobile long-press: horizontally centered, and vertically placed
        // below the finger in the upper half of the screen, above it in
        // the lower half.
        x = Math.max(margin, (window.innerWidth - rect.width) / 2)
        if (anchor.y < window.innerHeight / 2) {
          y = Math.max(margin, Math.min(anchor.y + gap, window.innerHeight - rect.height - bottomGap))
        } else {
          y = Math.max(margin, Math.min(anchor.y - rect.height - gap, window.innerHeight - rect.height - bottomGap))
        }
      }
      setPos({ x, y })
    }
    clamp()
    window.addEventListener('resize', clamp)
    return () => window.removeEventListener('resize', clamp)
  }, [anchor, pickerOpen, sheet, touchUI])

  useLayoutEffect(() => {
    const onDown = (e: Event) => {
      if (ref.current?.contains(e.target as Node | null)) return
      closeRef.current()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    // Capture phase sees every scroll — but a wheel inside the palette (or
    // the menu itself) must not dismiss what the user is browsing.
    const onScroll = (e: Event) => {
      if (ref.current?.contains(e.target as Node | null)) return
      closeRef.current()
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [])

  const item = (
    label: string,
    icon: ReactNode,
    run: () => void,
    danger = false,
    expandable?: { expanded: boolean },
  ) => (
    <button
      key={label}
      type="button"
      role="menuitem"
      className={`msg-menu-item${danger ? ' is-danger' : ''}`}
      aria-expanded={expandable ? expandable.expanded : undefined}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        run()
      }}
    >
      <span className="msg-menu-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="msg-menu-label">{label}</span>
      {expandable && (
        <span
          className={`msg-menu-chevron${expandable.expanded ? ' is-open' : ''}`}
          aria-hidden="true"
        >
          <ChevronRightIcon size={16} />
        </span>
      )}
    </button>
  )

  /**
   * Cancel: back to the full menu — unless the confirm view was the
   * entry point itself (hover-bar delete icon), then the whole menu
   * simply closes.
   */
  const cancelConfirm = () => {
    if (initialConfirm) onClose()
    else setConfirming(false)
  }

  return (
    <div
      ref={ref}
      className={`msg-menu${sheet ? ' is-sheet' : ''}${sheet && confirming ? ' is-confirming' : ''}`}
      role="menu"
      aria-label={t('消息操作', 'Message actions')}
      style={sheet ? undefined : { left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {confirming ? (
        <div className="msg-menu-confirm" role="alertdialog" aria-label={t('删除确认', 'Delete confirm')}>
          <p className="msg-menu-confirm-text">{t('删除这条消息？', 'Delete this message?')}</p>
          <div className="msg-menu-confirm-row">
            <button
              type="button"
              className="msg-menu-confirm-btn"
              onClick={(e) => {
                e.stopPropagation()
                cancelConfirm()
              }}
            >
              {t('取消', 'Cancel')}
            </button>
            <button
              type="button"
              className="msg-menu-confirm-btn is-danger"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(entry)
              }}
            >
              {t('删除', 'Delete')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            ref={rowRef}
            className="msg-menu-emojis"
            role="group"
            aria-label={t('快捷表情', 'Quick reactions')}
          >
            {getQuickEmojis(fit).map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="msg-menu-emoji"
                onClick={(e) => {
                  e.stopPropagation()
                  onReact(emoji)
                }}
                aria-label={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          {item(t('添加表情', 'Add Reaction'), <ReactIcon size={18} />, () => setPickerOpen((v) => !v), false, {
            expanded: pickerOpen,
          })}
          {pickerOpen && (
            <div
              className="msg-menu-picker"
              role="group"
              aria-label={t('表情选择', 'Emoji picker')}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {REACTION_PALETTE.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="msg-menu-pick"
                  onClick={(e) => {
                    e.stopPropagation()
                    onReact(emoji)
                  }}
                  aria-label={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <div className="msg-menu-sep" aria-hidden="true" />
          {item(t('回复', 'Reply'), <ReplyIcon size={18} />, () => onReply(entry))}
          {item(t('复制', 'Copy Text'), <CopyIcon size={18} />, () => onCopy(entry))}
          {mine && (
            <>
              <div className="msg-menu-sep" aria-hidden="true" />
              {item(t('编辑消息', 'Edit Message'), <EditIcon size={18} />, () => onEdit(entry))}
              {item(
                t('删除消息', 'Delete Message'),
                <TrashIcon size={18} />,
                () => setConfirming(true),
                true,
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
