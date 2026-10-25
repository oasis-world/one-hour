import { useEffect, useMemo, useRef, useState } from 'react'
import AccountDialog from './components/AccountDialog'
import BackgroundStage from './components/BackgroundStage'
import Composer from './components/Composer'
import ImageViewer from './components/ImageViewer'
import MessageList from './components/MessageList'
import ProfilePage from './components/ProfilePage'
import SettingsBar from './components/SettingsBar'
import TopBar from './components/TopBar'
import WelcomeModal from './components/WelcomeModal'
import { ChatBubbleIcon, ThinXIcon } from './components/icons'
import { useChatRoom } from './components/useChatRoom'
import { useAccount } from './lib/useAccount'
import { useUserProfile } from './lib/userProfile'
import { watchAccountForProfileSync } from './lib/profileCloud'
import { useMobileKeyboard } from './lib/useMobileKeyboard'
import './lib/settingsRuntime'
import { fileToChatImage } from './lib/imageBlob'
import { setLang, useLang } from './lib/i18n'
import { loadTheme, loadVeil, type ThemeName } from './lib/settings'

/**
 * 一小时 / one-hour — the ephemeral chat room. Every message, text or
 * photo, lives for exactly one hour on every client and in the cloud.
 *
 * Layout: the chat column sits center screen (50% wide desktop, 90% on
 * phones), the composer pill docks 20px above the bottom, and the newest
 * photo in the room paints the blurred fullscreen backdrop. The top-left
 * avatar holds the account menu, the bottom-left gear the room settings;
 * first visits pass through the welcome gate to pick a face + nickname.
 */

type FoldState = 'open' | 'folding' | 'folded' | 'unfolding'

const FOLD_MS = 500
const UNFOLD_MS = 540

export default function App() {
  const account = useAccount()
  const profile = useUserProfile()
  const room = useChatRoom(true)
  const lang = useLang()
  const zh = lang === 'zh'
  const [fold, setFold] = useState<FoldState>('open')
  /** Which account dialog view is open, if any. */
  const [accountView, setAccountView] = useState<'closed' | 'signin' | 'bind'>('closed')
  const [profileOpen, setProfileOpen] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  /** Composer popover open (plus/emoji) — mobile hides the gear meanwhile. */
  const [composerMenuOpen, setComposerMenuOpen] = useState(false)
  /**
   * A blank click that just dismissed a composer popover must not also
   * fold the chat: the popover closes on pointerdown, before this click
   * lands, so a plain boolean guard races. The dismissal timestamp is
   * recorded synchronously in the callback — an effect would flush too
   * late to guard the click that follows.
   */
  const menuClosedAt = useRef(0)
  const menuWasOpen = useRef(false)
  const handleMenuOpenChange = (open: boolean) => {
    setComposerMenuOpen(open)
    if (open) {
      menuWasOpen.current = true
    } else if (menuWasOpen.current) {
      menuWasOpen.current = false
      menuClosedAt.current = Date.now()
    }
  }
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  // Signed-in players carry their profile in the cloud; guests stay local.
  useEffect(() => watchAccountForProfileSync(), [])

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

  // The settings surfaces adjust these via the window helpers; the
  // events hot-swap the running shell.
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

  // The backdrop follows the newest photo in the log; the viewer browses
  // every live photo, oldest → newest.
  const chatImages = useMemo(() => {
    const urls: string[] = []
    for (const entry of room.entries) {
      if (entry.expiring || entry.state) continue
      const url = entry.imageUrl ?? entry.localImage
      if (url) urls.push(url)
    }
    return urls
  }, [room.entries])

  const latestImage = chatImages.length > 0 ? chatImages[chatImages.length - 1] : null

  const openImage = (src: string) => {
    const idx = chatImages.indexOf(src)
    if (idx >= 0) setViewerIndex(idx)
  }

  const chatMounted = fold !== 'folded'
  const shellRef = useRef<HTMLDivElement>(null)
  useMobileKeyboard(shellRef)
  const shellClass = [
    'app-shell',
    theme === 'warm' ? 'theme-warm' : '',
    fold === 'open' || fold === 'folding' || fold === 'unfolding' ? 'is-chat-open' : '',
  ].join(' ')

  return (
    <div ref={shellRef} className={shellClass} style={{ ['--veil' as string]: String(veil) }}>
      <BackgroundStage imageUrl={latestImage} revealed={fold === 'folded'} />

      <TopBar
        account={account}
        profile={profile}
        onSignIn={() => setAccountView('signin')}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenWelcome={() => setWelcomeOpen(true)}
      />

      <SettingsBar
        members={room.presence}
        selfId={room.identity?.userId ?? null}
        theme={theme}
        suppressed={composerMenuOpen}
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
        <div
          className="chat-stage"
          onClick={(e) => {
            // Desktop: the stage showing around the column is one big
            // "fold the chat" hit target; a click that only dismissed a
            // composer popover shouldn't fold the room as well.
            if (e.target !== e.currentTarget) return
            if (composerMenuOpen || Date.now() - menuClosedAt.current < 400) return
            closeChat()
          }}
        >
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
              onImageClick={openImage}
              onRetry={room.retry}
              onRemove={room.remove}
              onToast={showToast}
              onLoadOlder={room.loadOlder}
            />

            {room.identity ? (
              <Composer
                onSend={handleSend}
                onImagePicked={handleImagePicked}
                onMenuOpenChange={handleMenuOpenChange}
              />
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

      {viewerIndex != null && chatImages[viewerIndex] && (
        <ImageViewer
          images={chatImages}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
      {accountView !== 'closed' && (
        <AccountDialog
          account={account}
          initialMode={accountView === 'signin' ? 'signin' : 'bind'}
          onClose={() => setAccountView('closed')}
          onOpenProfile={() => {
            setAccountView('closed')
            setProfileOpen(true)
          }}
        />
      )}
      {profileOpen && (
        <ProfilePage
          account={account}
          onClose={() => setProfileOpen(false)}
          onOpenSignIn={() => {
            setProfileOpen(false)
            setAccountView('bind')
          }}
        />
      )}
      {(!profile || welcomeOpen) && (
        <WelcomeModal
          mode={profile ? 'edit' : 'welcome'}
          onClose={profile ? () => setWelcomeOpen(false) : undefined}
        />
      )}
      {toast && <div className="app-toast">{toast}</div>}
    </div>
  )
}
