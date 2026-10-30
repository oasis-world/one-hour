import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChatEntry, ChatStatus, MessageReply, PresenceMember } from '../lib/chatTypes'
import { setPopoverOpen } from '../lib/popoverGuard'
import {
  recordEmojiUse,
  type RoomReactionState,
} from '../lib/chatReactions'
import { t, useLang } from '../lib/i18n'
import MessageRow from './MessageRow'
import MessageMenu, { type MenuAnchor } from './MessageMenu'
import { HourglassIcon } from './icons'
import { useChatScroll } from './useChatScroll'
import { parseGameRef } from '../games/types'
import { deleteGomokuState } from '../games/gomoku/cloudState'

interface Props {
  entries: ChatEntry[]
  selfId: string | null
  presence: PresenceMember[]
  status: ChatStatus
  layoutKey: boolean
  incomingMessageSequence: number
  sentMessageSequence: number
  reactions: RoomReactionState
  onImageClick: (src: string) => void
  onRetry: () => void
  onRemove: (id: string) => void
  onToast: (text: string) => void
  onLoadOlder: () => Promise<{ loaded: number; hasMore: boolean }>
  onReact: (entryId: string, emoji: string) => void
  onReply: (reply: MessageReply) => void
  onEdit: (entry: ChatEntry) => void
}

interface OpenMenu {
  entry: ChatEntry
  anchor: MenuAnchor
  sheet: boolean
  /** Open straight into the delete-confirmation view (hover bar entry). */
  confirm?: boolean
}

/**
 * The message log: translucent glass column, rows dissolving into the top
 * edge (the CSS mask on .chat-log). Scrolling to the top loads the older
 * page — local cache first, server only when the cache runs dry. Owns the
 * single open message menu (hover bar / right-click / mobile long-press
 * all funnel into it).
 */
export default function MessageList({
  entries,
  selfId,
  presence,
  status,
  layoutKey,
  incomingMessageSequence,
  sentMessageSequence,
  reactions,
  onImageClick,
  onRetry,
  onRemove,
  onToast,
  onLoadOlder,
  onReact,
  onReply,
  onEdit,
}: Props) {
  useLang() // re-render on language flips
  const logRef = useRef<HTMLDivElement>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasOlder, setHasOlder] = useState(true)
  const [menu, setMenu] = useState<OpenMenu | null>(null)
  const menuOpen = menu !== null

  // Report to the chat-stage guard: a blank click dismisses this menu on
  // pointerdown, and the click that follows must not fold the chat (or
  // trigger anything else under the cursor) — see popoverGuard.ts.
  useEffect(() => {
    if (!menuOpen) return
    setPopoverOpen(true)
    return () => setPopoverOpen(false)
  }, [menuOpen])
  const loadingRef = useRef(false)
  const anchorRef = useRef<{ height: number; firstId: string | undefined } | null>(null)
  const autoProbeRef = useRef(false)
  const previousStatusRef = useRef(status)

  const scroll = useChatScroll({ scrollRef: logRef, entries, incomingMessageSequence, layoutKey })
  const { jumpToEnd } = scroll
  const seenSentMessageRef = useRef(sentMessageSequence)

  useLayoutEffect(() => {
    if (seenSentMessageRef.current === sentMessageSequence) return
    seenSentMessageRef.current = sentMessageSequence
    // Mobile keyboards reflow the viewport after a send; defer the
    // scroll so it runs after layout settles instead of mid-reflow.
    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => jumpToEnd())
    })
    return () => window.cancelAnimationFrame(raf)
  }, [jumpToEnd, sentMessageSequence])

  const requestOlder = useCallback(() => {
    const el = logRef.current
    if (!el || loadingRef.current || !hasOlder) return
    loadingRef.current = true
    anchorRef.current = { height: el.scrollHeight, firstId: entries[0]?.id }
    setLoadingOlder(true)
    void onLoadOlder()
      .then((result) => {
        setHasOlder(result.hasMore)
        if (result.loaded > 0) autoProbeRef.current = false
      })
      .catch(() => {})
      .finally(() => {
        loadingRef.current = false
        setLoadingOlder(false)
      })
  }, [entries, hasOlder, onLoadOlder])

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    scroll.handleScroll()
    if (event.currentTarget.scrollTop <= 24) requestOlder()
  }

  // If the initial messages don't fill the viewport, there may be no scroll
  // gesture to discover that history is exhausted. Probe older pages until
  // the log can scroll or the server confirms this is the beginning.
  useEffect(() => {
    if (status === 'online' && previousStatusRef.current !== 'online') {
      autoProbeRef.current = false
    }
    previousStatusRef.current = status
    const el = logRef.current
    if (
      !el || loadingOlder || !hasOlder || entries.length === 0 ||
      status === 'offline' || autoProbeRef.current || el.scrollHeight > el.clientHeight + 1
    ) return
    autoProbeRef.current = true
    requestOlder()
  }, [entries.length, hasOlder, loadingOlder, requestOlder, status])

  // Keep the viewport anchored on the same oldest row after a page prepend.
  useLayoutEffect(() => {
    const anchor = anchorRef.current
    const el = logRef.current
    if (!anchor || !el || loadingOlder) return
    if (entries[0]?.id === anchor.firstId) {
      anchorRef.current = null
      return
    }
    el.scrollTop += el.scrollHeight - anchor.height
    anchorRef.current = null
  }, [entries, loadingOlder])

  // First paint: start at the newest line.
  const startedRef = useRef(scroll.hasSavedPosition)
  useLayoutEffect(() => {
    if (startedRef.current || entries.length === 0) return
    startedRef.current = true
    scroll.scrollToEnd()
  }, [entries, scroll])

  const copyEntry = (entry: ChatEntry) => {
    setMenu(null)
    const text = entry.content || entry.imageUrl || entry.localImage || ''
    void navigator.clipboard
      ?.writeText(text)
      .then(() => onToast(t('已复制', 'Copied')))
      .catch(() => onToast(t('复制失败', 'Copy failed')))
  }

  const removeEntry = (entry: ChatEntry) => {
    setMenu(null)
    // The author deletes — anonymous travelers included (the menu itself
    // only offers Delete on the player's own messages).
    if (entry.userId !== selfId) return
    const gameRef = parseGameRef(entry.content)
    if (gameRef) void deleteGomokuState(gameRef.instanceId)
    onRemove(entry.id)
  }

  const editEntry = (entry: ChatEntry) => {
    setMenu(null)
    if (entry.userId !== selfId) return
    onEdit(entry)
  }

  const reactEntry = (id: string, emoji: string) => {
    onReact(id, emoji)
    recordEmojiUse(emoji)
  }

  const jumpToReply = async (id: string) => {
    let target = document.getElementById(`msg-${id}`)
    if (!target && loadingRef.current) return
    let more = hasOlder
    while (!target && more) {
      loadingRef.current = true
      setLoadingOlder(true)
      let result: { loaded: number; hasMore: boolean }
      try {
        result = await onLoadOlder()
        more = result.hasMore
        setHasOlder(result.hasMore)
      } catch {
        break
      } finally {
        loadingRef.current = false
        setLoadingOlder(false)
      }
      if (result.loaded === 0) break
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
      })
      target = document.getElementById(`msg-${id}`)
    }
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.classList.add('is-reply-target')
    window.setTimeout(() => target?.classList.remove('is-reply-target'), 1500)
  }

  return (
    <div className="chat-log-wrap">
      <div className="chat-list-backdrop" aria-hidden="true" />
      <div
        className="chat-log"
        ref={logRef}
        onScroll={handleScroll}
        // Chat photos decode in after the send-time scroll ran and push
        // the bottom down — re-pin (capture: load/error don't bubble).
        onLoadCapture={scroll.stickToBottom}
        onErrorCapture={scroll.stickToBottom}
      >
        {loadingOlder && (
          <div className="chat-loading-older" role="status">
            {t('正在加载更早的消息…', 'Loading earlier messages…')}
          </div>
        )}
        {!hasOlder && entries.length > 0 && (
          <div className="chat-top-hint">{t('已经到顶部了', 'You’re at the top')}</div>
        )}
        {entries.length === 0 && (
          <p className="chat-empty">
            <strong>{t('欢迎来到一小时聊天室', 'Welcome to the one-hour room')}</strong>
            {t('每条消息只存在一个小时', 'Every message lives for just one hour')}{' '}
            <span className="chat-empty-hourglass">
              <HourglassIcon size={13} />
            </span>{' '}
            {t('留下的都是此刻，畅所欲言吧。', 'Say what matters, now.')}
          </p>
        )}
        {entries.map((entry) => (
          <MessageRow
            key={entry.id}
            entry={entry}
            mine={entry.userId === selfId}
            author={presence.find((member) => member.userId === entry.userId) ?? {
              userId: entry.userId,
              displayName: entry.displayName,
              avatarStyle: entry.avatarStyle ?? null,
              avatarSeed: entry.avatarSeed ?? null,
              avatarUrl: entry.avatarUrl ?? null,
              role: '',
              profileExpiresAt: entry.at + 60 * 60 * 1000,
              enteredAt: entry.at,
            }}
            menuOpen={menu?.entry.id === entry.id}
            reactions={reactions[entry.id]}
            onImageClick={onImageClick}
            onRetry={onRetry}
            onOpenMenu={(entry2, anchor, sheet, confirm) =>
              setMenu({ entry: entry2, anchor, sheet, confirm })
            }
            onReact={reactEntry}
            onCopy={copyEntry}
            onJumpToReply={jumpToReply}
          />
        ))}
        {status === 'offline' && (
          <p className="chat-offline-note">
            {t(
              '当前离线 — 消息已保留在本机，恢复网络后自动重发。',
              'Offline — messages are kept on this device and resend automatically.',
            )}
          </p>
        )}
      </div>
      {scroll.showJumpEnd && (
        <button
          type="button"
          className="chat-jump"
          aria-label={
            scroll.newMessageCount > 0
              ? t(
                  `回到底部，${scroll.newMessageCount} 条新消息`,
                  `Jump to latest, ${scroll.newMessageCount} new messages`,
                )
              : t('回到底部', 'Jump to latest')
          }
          title={
            scroll.newMessageCount > 0
              ? t(
                  `回到底部，${scroll.newMessageCount} 条新消息`,
                  `Jump to latest, ${scroll.newMessageCount} new messages`,
                )
              : t('回到底部', 'Jump to latest')
          }
          onClick={(e) => {
            e.stopPropagation()
            scroll.jumpToEnd()
          }}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
            <path
              d="M3 6l5 5 5-5"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {scroll.newMessageCount > 0 && (
            <span className="chat-jump-count" aria-hidden="true">
              {scroll.newMessageCount > 99 ? '99+' : scroll.newMessageCount}
            </span>
          )}
        </button>
      )}
      {menu?.sheet && (
        <button
          type="button"
          className="msg-sheet-backdrop"
          aria-label={t('关闭菜单', 'Close menu')}
          onClick={(e) => {
            e.stopPropagation()
            setMenu(null)
          }}
        />
      )}
      {menu && (
        <MessageMenu
          key={`${menu.entry.id}:${menu.confirm ? 'confirm' : 'menu'}`}
          entry={menu.entry}
          mine={menu.entry.userId === selfId}
          anchor={menu.anchor}
          sheet={menu.sheet}
          initialConfirm={menu.confirm}
          onClose={() => setMenu(null)}
          onReact={(emoji) => {
            // Menu picks dismiss the menu after reacting (oasis behavior);
            // the hover bar reacts in place and stays.
            reactEntry(menu.entry.id, emoji)
            setMenu(null)
          }}
          onCopy={copyEntry}
          onEdit={editEntry}
          onReply={(entry) => {
            onReply({
              id: entry.id,
              displayName: entry.displayName,
              content: entry.content,
              hasImage: Boolean(entry.imageUrl || entry.localImage),
            })
            setMenu(null)
          }}
          onDelete={removeEntry}
        />
      )}
    </div>
  )
}
