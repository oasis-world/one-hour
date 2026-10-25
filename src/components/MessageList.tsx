import { useLayoutEffect, useRef, useState } from 'react'
import type { ChatEntry, ChatStatus } from '../lib/chatTypes'
import { useLang } from '../lib/i18n'
import MessageRow from './MessageRow'
import { HourglassIcon } from './icons'
import { useChatScroll } from './useChatScroll'

interface Props {
  entries: ChatEntry[]
  selfId: string | null
  status: ChatStatus
  layoutKey: boolean
  onImageClick: (src: string) => void
  onRetry: () => void
  onLoadOlder: () => Promise<{ loaded: number; hasMore: boolean }>
}

/**
 * The message log: translucent glass column, rows dissolving into the top
 * edge and rising out of the bottom one (the CSS mask on .chat-log).
 * Scrolling to the top loads the older page — local cache first, server
 * only when the cache runs dry.
 */
export default function MessageList({
  entries,
  selfId,
  status,
  layoutKey,
  onImageClick,
  onRetry,
  onLoadOlder,
}: Props) {
  const lang = useLang()
  const zh = lang === 'zh'
  const logRef = useRef<HTMLDivElement>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasOlder, setHasOlder] = useState(true)
  const loadingRef = useRef(false)
  const anchorRef = useRef<{ height: number; firstId: string | undefined } | null>(null)

  const scroll = useChatScroll({ scrollRef: logRef, entries, layoutKey })

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    scroll.handleScroll()
    const el = event.currentTarget
    if (el.scrollTop > 24 || loadingRef.current || !hasOlder) return
    loadingRef.current = true
    anchorRef.current = { height: el.scrollHeight, firstId: entries[0]?.id }
    setLoadingOlder(true)
    void onLoadOlder()
      .then((result) => setHasOlder(result.hasMore))
      .finally(() => {
        loadingRef.current = false
        setLoadingOlder(false)
      })
  }

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
  const startedRef = useRef(false)
  useLayoutEffect(() => {
    if (startedRef.current || entries.length === 0) return
    startedRef.current = true
    scroll.scrollToEnd()
  }, [entries, scroll])

  return (
    <div className="chat-log-wrap">
      <div className="chat-list-backdrop" aria-hidden="true" />
      <div className="chat-log" ref={logRef} onScroll={handleScroll}>
        {loadingOlder && (
          <div className="chat-loading-older" role="status">
            {zh ? '正在加载更早的消息…' : 'Loading earlier messages…'}
          </div>
        )}
        {entries.length === 0 && (
          <p className="chat-empty">
            <strong>{zh ? '欢迎来到一小时聊天室' : 'Welcome to the one-hour room'}</strong>
            {zh ? '每条消息只存在一个小时' : 'Every message lives for just one hour'}{' '}
            <span className="chat-empty-hourglass">
              <HourglassIcon size={13} />
            </span>{' '}
            {zh ? '留下的都是此刻，畅所欲言吧。' : 'Say what matters, now.'}
          </p>
        )}
        {entries.map((entry, index) => (
          <MessageRow
            key={entry.id}
            entry={entry}
            previous={index > 0 ? entries[index - 1] : null}
            mine={entry.userId === selfId}
            onImageClick={onImageClick}
            onRetry={onRetry}
          />
        ))}
        {status === 'offline' && (
          <p className="chat-offline-note">
            {zh
              ? '当前离线 — 消息已保留在本机，恢复网络后自动重发。'
              : 'Offline — messages are kept on this device and resend automatically.'}
          </p>
        )}
      </div>
      {scroll.showJumpEnd && (
        <button
          type="button"
          className="chat-jump"
          aria-label={zh ? '回到底部' : 'Jump to latest'}
          title={zh ? '回到底部' : 'Jump to latest'}
          onClick={(e) => {
            e.stopPropagation()
            scroll.jumpToEnd()
          }}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
            <path
              d="M3 10l5-5 5 5"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  )
}
