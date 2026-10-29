import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { ChatEntry, PresenceMember } from '../lib/chatTypes'
import { t } from '../lib/i18n'
import { setPopoverOpen, suppressNextClick } from '../lib/popoverGuard'
import type { RoomReactionMap } from '../lib/chatReactions'
import { isAutoTravelerName } from '../lib/nickname'
import { findMessageMedia, stripRenderedMediaMarkup } from '../lib/messageMedia'
import MessageMediaEmbed from './MessageMediaEmbed'
import GameMessage from '../games/GameMessage'
import { parseGameRef } from '../games/types'
import { userAvatarTint, userNameColor } from '../lib/identity'
import AvatarBadge from './AvatarBadge'
import CountdownRing from './CountdownRing'
import { TravelerGlyph } from './icons'
import MsgHoverBar from './MsgHoverBar'
import MsgReactions from './MsgReactions'
import MessageAuthorCard from './MessageAuthorCard'

interface Props {
  entry: ChatEntry
  mine: boolean
  author: PresenceMember
  menuOpen: boolean
  reactions: RoomReactionMap | undefined
  onImageClick: (src: string) => void
  onRetry: () => void
  onOpenMenu: (
    entry: ChatEntry,
    anchor: { x: number; y: number },
    sheet: boolean,
    confirm?: boolean,
  ) => void
  onReact: (entryId: string, emoji: string) => void
  onCopy: (entry: ChatEntry) => void
  onJumpToReply: (id: string) => void
}

/** Touch form factors (phones, tablets) get the long-press sheet. */
function isTouchUI(): boolean {
  try {
    return (
      globalThis.matchMedia?.('(hover: none), (pointer: coarse)').matches ?? false
    )
  } catch {
    return false
  }
}

const TOUCH = typeof window === 'undefined' ? false : isTouchUI()

function isSingleEmoji(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || /\s/.test(trimmed)) return false
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    const segments = [...seg.segment(trimmed)]
    if (segments.length !== 1) return false
  } catch {
    if (Array.from(trimmed).length !== 1) return false
  }
  return /\p{Extended_Pictographic}/u.test(trimmed)
}

function renderMessageContent(content: string): ReactNode {
  if (!content) return content
  if (isSingleEmoji(content)) {
    return <span className="msg-emoji-single">{content}</span>
  }
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    const parts = [...seg.segment(content)].map((s) => s.segment)
    return parts.map((part, i) =>
      /\p{Extended_Pictographic}/u.test(part) ? (
        <span key={i} className="msg-emoji">
          {part}
        </span>
      ) : (
        part
      ),
    )
  } catch {
    return content
  }
}

/**
 * One message row (every row carries its own header — each message owns a
 * personal one-hour countdown): avatar gutter, name, a dot separator and
 * the hour-glass countdown, then the text and/or photo. No clock is shown:
 * the message lifetime is fixed at one hour, so the countdown is the only
 * time that matters. Desktop hover shows the quick toolbar; right-click
 * opens the context menu; on touch a 500ms long-press opens the bottom
 * sheet (scrolling aborts the press). Rows carry their own farewell —
 * `.is-expiring` plays the dissolve while the sync layer removes them
 * from the list underneath.
 */
export default function MessageRow({
  entry,
  mine,
  author,
  menuOpen,
  reactions,
  onImageClick,
  onRetry,
  onOpenMenu,
  onReact,
  onCopy,
  onJumpToReply,
}: Props) {
  const imageSrc = entry.imageUrl ?? entry.localImage ?? null
  const messageMedia = findMessageMedia(entry.content)
  const displayContent = stripRenderedMediaMarkup(entry.content)
  const gameRef = parseGameRef(entry.content)
  const [authorOpen, setAuthorOpen] = useState(false)
  const [authorPosition, setAuthorPosition] = useState<{ left: number; top: number } | null>(null)
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
  const avatarButtonRef = useRef<HTMLButtonElement>(null)
  const authorPopoverRef = useRef<HTMLDivElement>(null)
  const positionAuthor = (target: HTMLElement) => {
    const rect = target.getBoundingClientRect()
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - 284))
    const top = window.innerHeight - rect.bottom > 130 ? rect.bottom + 8 : rect.top - 112
    setAuthorPosition({ left, top })
  }
  const toggleAuthor = (event: MouseEvent<HTMLElement>) => {
    positionAuthor(event.currentTarget)
    setPortalRoot(event.currentTarget.closest<HTMLElement>('.app-shell'))
    setAuthorOpen((open) => !open)
  }

  useEffect(() => {
    if (!authorOpen) return
    setPopoverOpen(true)
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (avatarButtonRef.current?.contains(target) || authorPopoverRef.current?.contains(target)) return
      suppressNextClick()
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      setAuthorOpen(false)
    }
    window.addEventListener('pointerdown', dismissOutside, true)
    return () => {
      setPopoverOpen(false)
      window.removeEventListener('pointerdown', dismissOutside, true)
    }
  }, [authorOpen])

  // Mobile long-press → bottom sheet. Scrolling (pointermove / cancel)
  // aborts the press; interactive children opt out via the closest() guard.
  const pressTimer = useRef<number | null>(null)
  const pressStart = useRef<{ x: number; y: number } | null>(null)
  const sheetFired = useRef(false)

  const cancelPress = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
    pressStart.current = null
  }
  const endPress = () => {
    cancelPress()
    sheetFired.current = false
  }
  const openSheet = () => {
    const start = pressStart.current
    pressTimer.current = null
    pressStart.current = null
    sheetFired.current = true
    try {
      navigator.vibrate?.(15)
    } catch {
      // Haptics are best-effort.
    }
    // Show the menu just below the finger (desktop context-menu parity),
    // not as a centered bottom sheet. The clamp in MessageMenu pushes it
    // above the finger when there is no room below.
    const y = start?.y ?? window.innerHeight / 2
    onOpenMenu(entry, { x: window.innerWidth / 2, y }, false)
  }

  return (
    <div
      id={`msg-${entry.id}`}
      className={[
        'msg-row',
        mine ? 'is-mine' : '',
        entry.state ? `is-${entry.state}` : '',
        entry.expiring ? 'is-expiring' : '',
        menuOpen ? 'is-menu-open' : '',
      ].join(' ')}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (entry.expiring) return
        if (TOUCH) {
          // Native long-press menu (or our timer losing the race): the
          // sheet is already open when our timer won — swallow the dup.
          if (sheetFired.current) return
          cancelPress()
          openSheet()
          return
        }
        onOpenMenu(entry, { x: e.clientX, y: e.clientY }, false)
      }}
      onPointerDown={(e) => {
        if (!TOUCH || entry.expiring || e.pointerType === 'mouse') return
        const target = e.target as HTMLElement | null
        if (target?.closest?.('button, a, textarea, input, iframe')) return
        sheetFired.current = false
        pressStart.current = { x: e.clientX, y: e.clientY }
        if (pressTimer.current !== null) window.clearTimeout(pressTimer.current)
        pressTimer.current = window.setTimeout(openSheet, 500)
      }}
      onPointerMove={(e) => {
        const start = pressStart.current
        if (!start) return
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancelPress()
      }}
      onPointerUp={endPress}
      onPointerCancel={endPress}
    >
      <div className="msg-gutter">
        <button ref={avatarButtonRef} type="button" className="msg-author-avatar-trigger" aria-label={`Profile: ${entry.displayName}`} onClick={toggleAuthor}>
        {entry.avatarUrl || (entry.avatarStyle && entry.avatarSeed) ? (
          <AvatarBadge
            look={{
              style: entry.avatarStyle ?? 'lorelei',
              seed: entry.avatarSeed ?? '',
              url: entry.avatarUrl || null,
            }}
            size={TOUCH ? 37 : 35}
            className="msg-avatar-img"
          />
        ) : (
          <span
            className="msg-avatar"
            style={{ background: userAvatarTint(entry.userId), width: TOUCH ? 37 : 35, height: TOUCH ? 37 : 35 }}
          >
            {isAutoTravelerName(entry.displayName) ? (
              <TravelerGlyph size={19} />
            ) : (
              entry.displayName.slice(0, 1).toUpperCase()
            )}
          </span>
        )}
        </button>
      </div>
      <div className="msg-main">
        <div className="msg-head">
          <span className="msg-name" style={{ color: userNameColor(entry.userId) }}>
            {entry.displayName}
          </span>
          <span className="msg-dot" aria-hidden="true" />
          <CountdownRing entry={entry} />
        </div>
        {entry.replyTo && (
          <button
            type="button"
            className="msg-reply-quote"
            disabled={Boolean(entry.state)}
            onClick={() => entry.replyTo && onJumpToReply(entry.replyTo.id)}
            aria-label={t('跳转到被引用的消息', 'Jump to replied message')}
          >
            <span className="msg-reply-name">{entry.replyTo.displayName}</span>
            <span className="msg-reply-content">
              {entry.replyTo.content || (entry.replyTo.hasImage ? t('图片', 'Image') : '')}
            </span>
          </button>
        )}
        <div className="msg-body">
          {gameRef ? (
            <GameMessage content={entry.content} hostUserId={entry.userId} />
          ) : (
            renderMessageContent(displayContent)
          )}
          {entry.editedAt && (
            <span className="msg-edited">{t('（已编辑）', ' (edited)')}</span>
          )}
          {entry.state === 'pending' && (
            <span className="msg-state">{t('发送中…', ' sending…')}</span>
          )}
          {entry.state === 'failed' && (
            <button
              type="button"
              className="msg-state"
              onClick={onRetry}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
                font: 'inherit',
              }}
            >
              {t('重试', 'retry')}
            </button>
          )}
        </div>
        {imageSrc && (
          <img
            className={`msg-image${entry.state ? ' msg-image-pending' : ''}`}
            src={imageSrc}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onClick={() => !entry.expiring && onImageClick(imageSrc)}
          />
        )}
        {messageMedia.length > 0 && (
          <div className="msg-youtube-list">
            {messageMedia.map((media) => (
              <MessageMediaEmbed key={media.key} media={media} storageKey={`${entry.id}:${media.key}`} />
            ))}
          </div>
        )}
        {!entry.expiring && reactions && (
          <MsgReactions reactions={reactions} onToggle={(emoji) => onReact(entry.id, emoji)} />
        )}
        {!entry.expiring && (
          <MsgHoverBar
            mine={mine}
            onReact={(emoji) => onReact(entry.id, emoji)}
            onCopy={() => onCopy(entry)}
            onDelete={(anchor) => onOpenMenu(entry, anchor, false, true)}
            onMore={(anchor) => onOpenMenu(entry, anchor, false)}
          />
        )}
      </div>
      {authorOpen && authorPosition && createPortal(
        <div
          ref={authorPopoverRef}
          className="author-pop-portal"
          style={{ left: authorPosition.left, top: authorPosition.top }}
        >
          <MessageAuthorCard member={author} />
        </div>,
        portalRoot ?? document.body,
      )}
    </div>
  )
}
