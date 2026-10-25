import { useEffect, useMemo, useRef, useState } from 'react'
import AccountDialog from './components/AccountDialog'
import BackgroundStage from './components/BackgroundStage'
import Composer from './components/Composer'
import ImageViewer from './components/ImageViewer'
import MessageList from './components/MessageList'
import TopBar from './components/TopBar'
import { ChatBubbleIcon, ThinXIcon } from './components/icons'
import { useChatRoom } from './components/useChatRoom'
import { useAccount } from './lib/useAccount'
import { fileToChatImage } from './lib/imageBlob'
import { setLang, useLang } from './lib/i18n'
import { loadTheme, loadVeil, saveBgTtlMs, saveTheme, saveVeil, type ThemeName } from './lib/settings'

/**
 * 一小时 / one-hour — the ephemeral chat room. Every message, text or
 * photo, lives for exactly one hour on every client and in the cloud.
 *
 * Layout: the chat column sits center screen (50% wide desktop, 90% on
 * phones), the composer pill docks 20px above the bottom, and the newest
 * photo in the room paints the blurred fullscreen backdrop. Closing the
 * chat folds the whole column into the bottom-left corner and reveals the
 * backdrop in full clarity; a click anywhere unfolds it back.
 */

type FoldState = 'open' | 'folding' | 'folded' | 'unfolding'

const FOLD_MS = 500
const UNFOLD_MS = 540

export default function App() {
  const account = useAccount()
  const room = useChatRoom(true)
  const lang = useLang()
  const zh = lang === 'zh'
  const [fold, setFold] = useState<FoldState>('open')
  const [accountOpen, setAccountOpen] = useState(false)
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  const systemTheme = (): ThemeName => {
    try {
      return globalThis.matchMedia?.('(prefers-color-scheme: light)').matches
        ? 'warm'
        : 'dark'
    } catch {
      return 'dark'
    }
  }
  const [theme, setTheme] = useState<ThemeName>(() => loadTheme() ?? systemTheme())
  const [veil, setVeil] = useState<number>(() => loadVeil())

  // The settings dialog (designed separately) adjusts these via the
  // window helpers below; the events hot-swap the running shell.
  useEffect(() => {
    const onVeil = () => setVeil(loadVeil())
    const onTheme = () => setTheme(loadTheme() ?? systemTheme())
    window.addEventListener('one-hour:veil', onVeil)
    window.addEventListener('one-hour:theme', onTheme)
    return () => {
      window.removeEventListener('one-hour:veil', onVeil)
      window.removeEventListener('one-hour:theme', onTheme)
    }
  }, [])

  // Keep the document language in sync for a11y / IME hints.
  useEffect(() => {
    document.documentElement.lang = zh ? 'zh-CN' : 'en'
  }, [zh])

  const showToast = (text: string) => {
    setToast(text)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }

  const closeChat = () => {
    if (fold !== 'open') return
    setFold('folding')
    window.setTimeout(() => setFold('folded'), FOLD_MS)
  }

  const openChat = () => {
    if (fold !== 'folded') return
    setFold('unfolding')
    window.setTimeout(() => setFold('open'), UNFOLD_MS)
  }

  const handleSend = (text: string) => {
    room.send(text)
  }

  const handleImagePicked = async (file: File) => {
    try {
      const blob = await fileToChatImage(file)
      room.send('', blob)
    } catch {
      showToast(zh ? '这张图片读取失败，换一张试试' : 'Could not read that image — try another one')
    }
  }

  // The backdrop follows the newest photo in the log.
  const latestImage = useMemo(() => {
    for (let i = room.entries.length - 1; i >= 0; i -= 1) {
      const entry = room.entries[i]
      if (!entry.expiring && (entry.imageUrl || entry.localImage)) {
        return (entry.imageUrl ?? entry.localImage) as string
      }
    }
    return null
  }, [room.entries])

  const chatMounted = fold !== 'folded'
  const shellClass = [
    'app-shell',
    theme === 'warm' ? 'theme-warm' : '',
    fold === 'open' || fold === 'folding' || fold === 'unfolding' ? 'is-chat-open' : '',
  ].join(' ')

  return (
    <div className={shellClass} style={{ ['--veil' as string]: String(veil) }}>
      <BackgroundStage imageUrl={latestImage} revealed={fold === 'folded'} />

      <TopBar
        account={account}
        members={room.presence}
        selfId={room.identity?.userId ?? null}
        theme={theme}
        onAvatarClick={() => setAccountOpen(true)}
        onToggleTheme={() => window.setOneHourTheme?.(theme === 'dark' ? 'warm' : 'dark')}
        onToggleLang={() => setLang(zh ? 'en' : 'zh')}
      />

      {/* Page-corner close: small, top-right of the screen. */}
      {chatMounted && (
        <button
          type="button"
          className={`chat-close${fold === 'folding' ? ' is-fading' : ''}`}
          aria-label={zh ? '收起聊天' : 'Hide chat'}
          title={zh ? '收起聊天' : 'Hide chat'}
          onClick={(e) => {
            e.stopPropagation()
            closeChat()
          }}
        >
          <ThinXIcon size={13} />
        </button>
      )}

      {chatMounted ? (
        <div className="chat-stage">
          <div
            className={`chat-column${
              fold === 'folding' ? ' is-folded' : fold === 'unfolding' ? ' is-unfolding' : ''
            }`}
          >
            <MessageList
              entries={room.entries}
              selfId={room.identity?.userId ?? null}
              status={room.status}
              layoutKey={fold === 'unfolding'}
              onImageClick={setViewerSrc}
              onRetry={room.retry}
              onLoadOlder={room.loadOlder}
            />

            {room.identity ? (
              <Composer onSend={handleSend} onImagePicked={handleImagePicked} />
            ) : (
              <div className="composer-dock">
                <div className="composer" style={{ alignItems: 'center', minHeight: 52 }}>
                  <span
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontSize: 13,
                      color: 'var(--ink-mute)',
                      userSelect: 'none',
                    }}
                  >
                    {zh ? '正在建立身份，稍候即可畅聊…' : 'Setting up your identity…'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Click anywhere on the scene to pull the chat back out. */}
          <div
            className="chat-reopen-veil"
            onClick={openChat}
            role="button"
            aria-label={zh ? '展开聊天' : 'Open chat'}
          />
          <button type="button" className="chat-reopen-hint" onClick={openChat}>
            <ChatBubbleIcon />
            {zh ? '展开聊天' : 'Open chat'}
          </button>
        </>
      )}

      {viewerSrc && <ImageViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />}
      {accountOpen && (
        <AccountDialog account={account} onClose={() => setAccountOpen(false)} />
      )}
      {toast && <div className="app-toast">{toast}</div>}
    </div>
  )
}

/**
 * Runtime hooks for the future settings dialog: persist a value and ping
 * the shell through a custom event so the change applies without a reload.
 *   window.setOneHourVeil(0.6)          — chat background opacity 0–0.92
 *   window.setOneHourTheme('warm')      — 'warm' | 'dark' | null (= auto)
 *   window.setOneHourBgTtl(600000)      — backdrop rotation slot, ms (≥15s)
 */
declare global {
  interface Window {
    setOneHourVeil?(value: number): void
    setOneHourTheme?(theme: 'warm' | 'dark' | null): void
    setOneHourBgTtl?(ms: number): void
  }
}

if (typeof window !== 'undefined') {
  window.setOneHourVeil = (value: number) => {
    saveVeil(value)
    window.dispatchEvent(new Event('one-hour:veil'))
  }
  window.setOneHourTheme = (theme: 'warm' | 'dark' | null) => {
    saveTheme(theme)
    window.dispatchEvent(new Event('one-hour:theme'))
  }
  window.setOneHourBgTtl = (ms: number) => {
    saveBgTtlMs(ms)
    window.dispatchEvent(new Event('one-hour:bg-ttl'))
  }
}
