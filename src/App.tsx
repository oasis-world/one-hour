import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
// EXPERIMENT: sign-in disabled.
// import AccountDialog from './components/AccountDialog'
import BackgroundStage from './components/BackgroundStage'
import Composer from './components/Composer'
import ImageViewer from './components/ImageViewer'
import CreatePollModal from './components/CreatePollModal'
import GamePickerModal from './components/GamePickerModal'
import MessageList from './components/MessageList'
// EXPERIMENT: profile page disabled.
// import ProfilePage from './components/ProfilePage'
import SettingsBar from './components/SettingsBar'
import TopBar from './components/TopBar'
import WelcomeModal from './components/WelcomeModal'
import SummaryModal from './components/SummaryModal'
import ChatTopAvatar from './components/ChatTopAvatar'
import { BackgroundImageIcon, ChatBubbleIcon, PlusIcon } from './components/icons'
import { useChatRoom } from './components/useChatRoom'
import { useAccount } from './lib/useAccount'
import { useUserProfile } from './lib/userProfile'
import { setProfileExpiresAt } from './lib/userProfile'
import { expireAnonymousProfile, getProfileExpiresAt } from './lib/profileLifetime'
import { getGameById } from './games/registry'
import { watchAccountForProfileSync } from './lib/profileCloud'
import { useMobileKeyboard } from './lib/useMobileKeyboard'
import './lib/settingsRuntime'
import { fileToChatImage, looksLikeHeic } from './lib/imageBlob'
import { withTimeout } from './lib/withTimeout'
import { popoverJustClosed } from './lib/popoverGuard'
import { useLang, t } from './lib/i18n'
import {
  loadPendingSummary,
  savePendingSummary,
  clearPendingSummary,
  loadStats,
  recordMessageSent,
  recordInteraction,
  resetStats,
  type PendingSummary,
} from './lib/lifetimeStats'
import { pauseMessageMedia, resumeMessageMedia } from './lib/mediaPlayback'
import { useBackgroundMusic } from './lib/useBackgroundMusic'
import { loadCountdownAnimation, loadTheme, loadVeil, saveCountdownAnimation, type ThemeName } from './lib/settings'
import type { CountdownAnimation } from './lib/countdownAnimations'
import type { ChatEntry, MessageReply } from './lib/chatTypes'
import { getCompanionIfAlive, clearCompanionProfile, subscribeCompanion, type CompanionProfile } from './lib/companionProfile'
import { clearCompanionMessages, loadCompanionMessages, saveCompanionMessage, createUserCompanionMessage, createCompanionReply, pruneCompanionMessages, companionMessageExpiresAt, removeCompanionMessage } from './lib/companionStore'
import type { CompanionMessage } from './lib/companionStore'
import { requestCompanionGreeting, requestCompanionReply, toHistory } from './lib/companionChat'
import { containsCompanionMention } from './lib/mention'
import { createCompanionGame, gameTitle } from './lib/companionGame'
import { isEnterPrivateChatIntent } from './lib/privateChatIntent'
import { applyRoomReactionChange, recordEmojiUse, summarizeRoomReactions, type RoomReactionRecord } from './lib/chatReactions'
import { createPoll } from './lib/pollRemote'
import { buildPollContent, durationMinutes, newPollId, type PollDraft } from './lib/pollTypes'
import { clearLocalReactions, loadLocalReactions, pruneLocalReactions, removeLocalReaction, removeLocalReactionsForMessage, saveLocalReaction } from './lib/localReactions'

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

  // Backfill an expiry for profiles created before the lifetime rule existed.
  useEffect(() => {
    if (profile && getProfileExpiresAt() == null) {
      setProfileExpiresAt(Date.now() + 60 * 60 * 1000)
    }
  }, [profile])
  const lang = useLang()
  const zh = lang === 'zh'
  const [fold, setFold] = useState<FoldState>('folded')
  /** First remote (or fallback) background is ready — starts the chat reveal delay. */
  const [bgReady, setBgReady] = useState(false)
  /** Whether the initial choreography has completed (gates the reopen hint). */
  const [hasRevealed, setHasRevealed] = useState(false)
  const backgroundMusic = useBackgroundMusic(lang, Boolean(profile))
  const { audioRef, muted: musicMuted, playing: musicPlaying, toggle: toggleMusic, ended: handleTrackEnded } = backgroundMusic
  // EXPERIMENT: sign-in / sign-out (email account binding) disabled while
  // testing the anonymous-only flow. Kept here (commented) for rollback.
  // const [accountView, setAccountView] = useState<'closed' | 'signin' | 'bind'>('closed')
  // EXPERIMENT: profile page disabled.
  // const [profileOpen, setProfileOpen] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [pollOpen, setPollOpen] = useState(false)
  const [gamePickerOpen, setGamePickerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  /** Composer popover open (plus/emoji) — mobile hides the gear meanwhile. */
  const [composerMenuOpen, setComposerMenuOpen] = useState(false)
  /** Mobile top-right tool stack (background / music / gear / online) —
      collapsed behind one toggle; ignored on desktop (toggle hidden). */
  const [cornerOpen, setCornerOpen] = useState(false)
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
  const [replyTo, setReplyTo] = useState<MessageReply | null>(null)
  const [editingMessage, setEditingMessage] = useState<ChatEntry | null>(null)
  const [sentMessageSequence, setSentMessageSequence] = useState(0)
  const toastTimer = useRef<number | null>(null)
  const bgReadyRef = useRef(false)
  const revealTimer = useRef<number | null>(null)
  const revealStageTimer = useRef<number | null>(null)
  /** True from the moment a reveal is scheduled until it reaches 'open'.
      Return-to-app fires both visibilitychange and focus — without this
      the second call would clobber the first mid-flight (its inner timer
      escapes cancellation) and the unfold animation plays twice. */
  const revealActive = useRef(false)
  const cancelRevealTimers = useCallback(() => {
    if (revealTimer.current) {
      window.clearTimeout(revealTimer.current)
      revealTimer.current = null
    }
    if (revealStageTimer.current) {
      window.clearTimeout(revealStageTimer.current)
      revealStageTimer.current = null
    }
  }, [])

  const scheduleReveal = useCallback(() => {
    cancelRevealTimers()
    revealActive.current = true
    setFold('folded')
    revealTimer.current = window.setTimeout(() => {
      revealTimer.current = null
      setFold('unfolding')
      revealStageTimer.current = window.setTimeout(() => {
        revealStageTimer.current = null
        revealActive.current = false
        setFold('open')
        resumeMessageMedia()
        setHasRevealed(true)
      }, UNFOLD_MS)
    }, 2500)
  }, [cancelRevealTimers])

  const markBgReady = useCallback(() => {
    if (bgReadyRef.current) return
    bgReadyRef.current = true
    setBgReady(true)
    const splash = document.getElementById('splash')
    if (splash) {
      const delay = Math.max(0, 350 - performance.now())
      window.setTimeout(() => {
        splash.classList.add('is-done')
        window.setTimeout(() => splash.remove(), 450)
      }, delay)
    }
  }, [])

  // Signed-in players carry their profile in the cloud; guests stay local.
  useEffect(() => watchAccountForProfileSync(), [])

  // Anonymous users live exactly one hour: when the countdown hits zero,
  // purge the profile (local + cloud) and recreate the anonymous session,
  // which re-opens the welcome gate.
  const expiringRef = useRef(false)
  const currentUserId = room.identity?.userId
  const expireUserMessages = room.expireUserMessages
  const [pendingSummary, setPendingSummary] = useState<PendingSummary | null>(() => loadPendingSummary())
  useEffect(() => {
    const check = () => {
      // Already in summary window: nothing to do.
      if (loadPendingSummary()) {
        if (!pendingSummary) setPendingSummary(loadPendingSummary())
        return
      }
      const exp = getProfileExpiresAt()
      if (!exp || expiringRef.current) return
      if (Date.now() < exp) return
      expiringRef.current = true
      if (currentUserId) expireUserMessages(currentUserId)
      clearCompanionProfile()
      void clearCompanionMessages()
      void clearLocalReactions()
      setLocalReactionRows([])
      const summary: PendingSummary = {
        stats: loadStats(),
        profileExpiresAt: exp,
        startedAt: Date.now(),
      }
      savePendingSummary(summary)
      setPendingSummary(summary)
      expiringRef.current = false
    }
    check()
    const id = window.setInterval(check, 1000)
    return () => window.clearInterval(id)
  }, [currentUserId, expireUserMessages, pendingSummary])

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
  const [countdownAnimation, setCountdownAnimation] = useState<CountdownAnimation>(loadCountdownAnimation)

  const changeCountdownAnimation = (animation: CountdownAnimation) => {
    setCountdownAnimation(animation)
    saveCountdownAnimation(animation)
  }

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
    const langMap: Record<string, string> = {
      zh: 'zh-CN',
      'zh-TW': 'zh-TW',
      ja: 'ja',
      fr: 'fr',
      es: 'es',
      de: 'de',
      ko: 'ko',
      it: 'it',
      ar: 'ar',
      en: 'en',
    }
    document.documentElement.lang = langMap[lang] ?? 'en'
    // Localized home-screen name for iOS "Add to Home Screen".
    document.title = t('一小时', 'One Hour')
  }, [zh, lang])

  // Once the background is ready and the welcome gate is complete, let the
  // scene sit for 2.5s before unfolding the chat from the bottom-left.
  useEffect(() => {
    if (!bgReady || !profile) return
    const timer = window.setTimeout(scheduleReveal, 0)
    return () => window.clearTimeout(timer)
  }, [bgReady, profile, scheduleReveal])

  // Fallback: if no background arrives (offline / blocked), promote the
  // CSS blur backdrop after 4s so the app is never stuck on the splash.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!bgReadyRef.current) markBgReady()
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [markBgReady])

  const showToast = (text: string) => {
    setToast(text)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }

  const [companion, setCompanion] = useState<CompanionProfile | null>(() => getCompanionIfAlive())
  const PRIVATE_MODE_KEY = 'one-hour-private-mode'
  const [privateMode, setPrivateMode] = useState<boolean>(() => {
    try { return globalThis.localStorage?.getItem(PRIVATE_MODE_KEY) === '1' } catch { return false }
  })
  useEffect(() => {
    try {
      if (privateMode) globalThis.localStorage?.setItem(PRIVATE_MODE_KEY, '1')
      else globalThis.localStorage?.removeItem(PRIVATE_MODE_KEY)
    } catch { /* noop */ }
  }, [privateMode])
  // Companion expiry clears private mode
  useEffect(() => { if (!companion) setPrivateMode(false) }, [companion])
  const [privateMessages, setPrivateMessages] = useState<CompanionMessage[]>([])
  const [companionTyping, setCompanionTyping] = useState(false)
  const [userTyping, setUserTyping] = useState(false)
  const privateMessagesRef = useRef<CompanionMessage[]>([])
  useEffect(() => { privateMessagesRef.current = privateMessages }, [privateMessages])
  const enterPrivateChat = useCallback(() => {
    setPrivateMode(true)
    const el = document.querySelector('.composer-input') as HTMLTextAreaElement | null
    if (el) {
      el.focus()
      try { const len = el.value.length; el.setSelectionRange(len, len) } catch {}
      requestAnimationFrame(() => {
        const el2 = document.querySelector('.composer-input') as HTMLTextAreaElement | null
        el2?.focus()
      })
    }
  }, [])
  const exitPrivateChat = useCallback(() => setPrivateMode(false), [])
  // Whisper: single-shot private to a live user via @mention selection
  const [pendingWhisper, setPendingWhisper] = useState<import('./lib/chatTypes').PresenceMember | null>(null)
  const [pendingInsertName, setPendingInsertName] = useState<string | null>(null)
  const handleWhisperSelect = useCallback((member: import('./lib/chatTypes').PresenceMember) => {
    setPendingWhisper(member)
  }, [])
  const handleMemberPrivateClick = useCallback((member: import('./lib/chatTypes').PresenceMember) => {
    if (!member) return
    // Don't whisper to self
    if (member.userId === room.identity?.userId) return
    // Check if it's companion synthetic member
    if (companion && member.userId === companion.id) {
      enterPrivateChat()
      return
    }
    setPendingWhisper(member)
    setPendingInsertName(member.displayName)
  }, [room.identity, companion, enterPrivateChat])
  const consumeInsert = useCallback(() => setPendingInsertName(null), [])
  // Reactions for local messages (companion chats + MUD card) — persisted in IndexedDB
  const [localReactionRows, setLocalReactionRows] = useState<RoomReactionRecord[]>([])
  useEffect(() => subscribeCompanion(setCompanion), [])
  useEffect(() => {
    const tick = () => { const alive = getCompanionIfAlive(); setCompanion((prev) => (prev?.id !== alive?.id || prev?.expiresAt !== alive?.expiresAt ? alive : prev)) }
    const id = window.setInterval(tick, 2000)
    const onStorage = () => tick()
    window.addEventListener('storage', onStorage)
    return () => { window.clearInterval(id); window.removeEventListener('storage', onStorage) }
  }, [])
  useEffect(() => {
    let alive = true
    void loadCompanionMessages().then((rows) => {
      if (!alive) return
      setPrivateMessages((prev) => {
        // Race fix: the greeting may have been created while this load was
        // in flight. If DB snapshot was empty but we already have a greeting
        // in memory, keep it instead of wiping with [].
        if (prev.length > 0 && rows.length === 0) return prev
        return rows
      })
    })
    return () => { alive = false }
  }, [companion?.id])
  useEffect(() => {
    const id = window.setInterval(() => {
      void pruneCompanionMessages().then(() => loadCompanionMessages().then(setPrivateMessages).catch(() => {}))
      if (getCompanionIfAlive() == null && companion) setCompanion(null)
    }, 10_000)
    return () => window.clearInterval(id)
  }, [companion])
  // Local reactions for companion / MUD card messages — load once and prune dangling rows
  useEffect(() => {
    void loadLocalReactions().then(setLocalReactionRows).catch(() => {})
  }, [])
  useEffect(() => {
    if (privateMessages.length === 0) return
    const validIds = new Set(privateMessages.map((m) => m.id))
    void pruneLocalReactions(validIds).then(() => loadLocalReactions().then(setLocalReactionRows).catch(() => {})).catch(() => {})
  }, [privateMessages])

  const greetedRef = useRef<string | null>(null)
  // Welcome choreography: background → chat reveal → then greet with typing.
  // Wait for hasRevealed so the typing bubble is actually visible when chat opens.
  useEffect(() => {
    if (!profile || !companion || !hasRevealed) return
    if (privateMessages.length > 0) return
    if (greetedRef.current === companion.id) return
    const key = `one-hour-companion-greeted:${companion.id}`
    if (globalThis.localStorage?.getItem(key)) { greetedRef.current = companion.id; return }
    greetedRef.current = companion.id
    globalThis.localStorage?.setItem(key, '1')
    setCompanionTyping(true)
    const typingStart = Date.now()
    void (async () => {
      let greetingText = ''
      try {
        greetingText = await requestCompanionGreeting(companion)
      } catch {
        greetingText = ''
      }
      // Ensure the typing bubble is seen for at least 900ms even on fast fallback
      const elapsed = Date.now() - typingStart
      if (elapsed < 900) await new Promise<void>((r) => window.setTimeout(r, 900 - elapsed))
      if (!greetingText) {
        setCompanionTyping(false)
        return
      }
      setCompanionTyping(false)
      const msg = createCompanionReply(greetingText) as CompanionMessage
      msg.kind = 'greeting'
      await saveCompanionMessage(msg)
      setPrivateMessages((prev) => [...prev, msg])
      setSentMessageSequence((s) => s + 1)
      await new Promise<void>((r) => window.setTimeout(r, 300))
      setCompanionTyping(false)
    })()
    return () => { setCompanionTyping(false); setUserTyping(false) }
  }, [profile, companion, privateMessages.length, hasRevealed])
  const handleSummaryComplete = () => {
    if (currentUserId) expireUserMessages(currentUserId)
    expireAnonymousProfile(currentUserId)
    clearCompanionProfile()
    void clearCompanionMessages()
    void clearLocalReactions()
    setPrivateMessages([])
    setLocalReactionRows([])
    setCompanion(null)
    resetStats()
    clearPendingSummary()
    setPendingSummary(null)
    expiringRef.current = false
  }

  const closeChat = () => {
    if (fold !== 'open') return
    pauseMessageMedia()
    setFold('folding')
    window.setTimeout(() => setFold('folded'), FOLD_MS)
  }

  const openChat = () => {
    if (fold !== 'folded') return
    // Take over any scheduled replay: the player is opening the chat NOW.
    // Otherwise the replay's late unfold lands after this one (or refolds
    // mid-unfold) and the bottom-left popup plays twice.
    cancelRevealTimers()
    revealActive.current = true
    setFold('unfolding')
    revealStageTimer.current = window.setTimeout(() => {
      revealStageTimer.current = null
      revealActive.current = false
      setFold('open')
      resumeMessageMedia()
    }, UNFOLD_MS)
  }

  const handleCompanionGame = async (gameId: 'gomoku' | 'xiangqi' | 'chess') => {
    if (!room.identity || !companion) return
    const instanceId = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))
    const title = gameTitle(gameId, t)
    room.send(`🎮 ${title}\n__GAME__:${gameId}:${instanceId}`, undefined, null)
    recordMessageSent()
    setSentMessageSequence((s) => s + 1)
    // Create game state with companion already joined; host is current user
    try {
      await createCompanionGame(gameId, instanceId, room.identity, companion)
    } catch (e) { console.warn('[companion] auto-join failed', e) }
  }

  const sendPrivateAndReply = async (text: string) => {
    if (!companion) return
    const userMsg = createUserCompanionMessage(text)
    await saveCompanionMessage(userMsg)
    setPrivateMessages((prev) => [...prev, userMsg])
    setSentMessageSequence((s) => s + 1)
    setReplyTo(null)
    setCompanionTyping(true)
    try {
      const history = toHistory([...privateMessages, userMsg])
      const result = await requestCompanionReply(companion, text, history.slice(0, -1))
      const botMsg = createCompanionReply(result.reply)
      await saveCompanionMessage(botMsg)
      setPrivateMessages((prev) => [...prev, botMsg])
      setSentMessageSequence((s) => s + 1)
      if (result.game) {
        void handleCompanionGame(result.game)
        const sys = createCompanionReply(t(`已为你创建${gameTitle(result.game, t)}对局，伙伴已加入`, `Created ${gameTitle(result.game, t)} — your companion has joined`))
        await saveCompanionMessage(sys)
        setPrivateMessages((prev) => [...prev, sys])
      }
    } catch (e) { console.warn('[companion] reply failed', e) }
    finally { setCompanionTyping(false) }
  }

  const handleSend = (text: string, reply?: MessageReply | null) => {
    // Whisper takes precedence: explicit pending target from @ selection
    if (pendingWhisper && text.includes(`@${pendingWhisper.displayName}`)) {
      room.send(text, undefined, reply, { whisperTo: pendingWhisper.userId, whisperToName: pendingWhisper.displayName })
      recordMessageSent()
      if (pendingWhisper.userId !== (room.identity?.userId ?? null)) {
        recordInteraction(pendingWhisper.userId, pendingWhisper.displayName, room.identity?.userId ?? undefined)
      }
      setPendingWhisper(null)
      setSentMessageSequence((sequence) => sequence + 1)
      setReplyTo(null)
      return
    }
    // Fallback: if text contains @<onlineMember> even without pendingWhisper, treat as whisper to that member
    // This covers manual typing of @ without using the popup selection.
    if (room.presence.length > 0) {
      const lastAt = text.lastIndexOf('@')
      if (lastAt !== -1) {
        const after = text.slice(lastAt + 1).split(/\s/)[0]?.trim()
        if (after) {
          const hit = room.presence.find((m) => m.displayName === after && m.userId !== room.identity?.userId)
          if (hit && text.includes(`@${hit.displayName}`)) {
            room.send(text, undefined, reply, { whisperTo: hit.userId, whisperToName: hit.displayName })
            recordMessageSent()
            recordInteraction(hit.userId, hit.displayName, room.identity?.userId ?? undefined)
            setSentMessageSequence((sequence) => sequence + 1)
            setReplyTo(null)
            return
          }
        }
      }
    }
    const isMention = companion ? containsCompanionMention(text, companion) : false
    const isIntent = isEnterPrivateChatIntent(text)
    const wantsPrivate = Boolean(companion && (privateMode || isMention || isIntent))
    if (wantsPrivate && companion) {
      if (isIntent) setPrivateMode(true)
      void sendPrivateAndReply(text)
      return
    }
    room.send(text, undefined, reply)
    recordMessageSent()
    if (reply?.userId && reply.userId !== (room.identity?.userId ?? null)) {
      recordInteraction(reply.userId, reply.displayName, room.identity?.userId ?? undefined)
    }
    setSentMessageSequence((sequence) => sequence + 1)
    setReplyTo(null)
  }

  const handleStartGame = (gameId: string) => {
    const instanceId = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))
    const game = getGameById(gameId)
    const title = game ? t(game.name, game.nameEn) : gameId
    room.send(`🎮 ${title}\n__GAME__:${gameId}:${instanceId}`, undefined, replyTo)
    recordMessageSent()
    setSentMessageSequence((sequence) => sequence + 1)
    setReplyTo(null)
  }

  const handleStartEdit = (entry: ChatEntry) => {
    setEditingMessage(entry)
    setReplyTo(null)
  }

  /** Create a poll: persist its ballot row first, then post the card message. */
  const handleSendPoll = async (draft: PollDraft): Promise<boolean> => {
    if (!room.identity) return false
    const pollId = newPollId()
    const expiresAt = Date.now() + durationMinutes(draft.durationId) * 60_000
    const created = await createPoll({
      pollId,
      userId: room.identity.userId,
      question: draft.question,
      options: draft.options,
      multiple: draft.multiple,
      expiresAt,
    })
    if (!created.ok) {
      showToast(
        created.error === 'offline'
          ? t('离线，投票需要网络连接', 'Offline — polls need a connection')
          : t('投票发布失败，请重试', 'Could not publish the poll — try again'),
      )
      return false
    }
    room.send(buildPollContent(draft.question, pollId), undefined, replyTo, { expiresAt })
    recordMessageSent()
    setSentMessageSequence((sequence) => sequence + 1)
    setReplyTo(null)
    return true
  }
  const handleEditMessage = (id: string, text: string) => {
    room.edit(id, text)
    setEditingMessage(null)
  }

  const handleImagePicked = async (file: File) => {
    try {
      const blob = await withTimeout(fileToChatImage(file), 60_000)
      const whisperOpt = pendingWhisper ? { whisperTo: pendingWhisper.userId, whisperToName: pendingWhisper.displayName } : undefined
      if (whisperOpt) setPendingWhisper(null)
      room.send('', blob, replyTo, whisperOpt)
      recordMessageSent()
      setSentMessageSequence((sequence) => sequence + 1)
      setReplyTo(null)
    } catch {
      showToast(
        looksLikeHeic(file)
          ? t('iPhone 高效格式（HEIC）暂不支持，请改用 JPEG 或截图发送', 'HEIC photos are not supported — send a JPEG or screenshot instead')
          : t('这张图片读取失败，换一张试试', 'Could not read that image — try another one'),
      )
    }
  }

  /**
   * Photo-library batch: at most 5, each converted then sent as its own
   * message so every photo gets an independent countdown and retry.
   * Sequential conversion keeps mobile memory flat; a per-file timeout
   * keeps one hung decode from stalling the rest of the batch.
   */
  const handleImagesPicked = async (files: File[]) => {
    if (files.length > 5) {
      showToast(t('一次最多发送 5 张照片，多余的已略过', 'You can send up to 5 photos at a time — extras skipped'))
    }
    let sent = 0
    let replyForNext = replyTo
    let heicFailed = 0
    let otherFailed = 0
    for (const file of files.slice(0, 5)) {
      try {
        const blob = await withTimeout(fileToChatImage(file), 60_000)
        const whisperOpt = pendingWhisper ? { whisperTo: pendingWhisper.userId, whisperToName: pendingWhisper.displayName } : undefined
        room.send('', blob, replyForNext, whisperOpt)
        recordMessageSent()
        setSentMessageSequence((sequence) => sequence + 1)
        if (replyForNext) {
          replyForNext = null
          setReplyTo(null)
        }
        sent += 1
      } catch {
        if (looksLikeHeic(file)) heicFailed += 1
        else otherFailed += 1
      }
    }
    const failed = heicFailed + otherFailed
    // Whisper is single-shot — clear after batch
    if (pendingWhisper && sent > 0) setPendingWhisper(null)
    if (failed === 0) return
    if (sent === 0 && otherFailed === 0) {
      showToast(t('iPhone 高效格式（HEIC）暂不支持，请改用 JPEG 或截图发送', 'HEIC photos are not supported — send a JPEG or screenshot instead'))
    } else {
      showToast(t(`${sent} 张已发出，${failed} 张读取失败`, `${sent} sent, ${failed} failed to read`))
    }
  }

  // Merge private companion messages into the public log (sorted by time, local-only)
  // Private messages share the same 1h lifecycle as the user/companion profile — cap to companion.expiresAt
  const privateChatEntries: ChatEntry[] = useMemo(() => {
    if (!companion) return []
    return privateMessages.map((m): ChatEntry => {
      const isUser = m.from === 'user'
      return {
        id: m.id, userId: isUser ? (room.identity?.userId ?? 'me') : companion.id,
        displayName: isUser ? (profile?.nickname ?? '我') : companion.name,
        avatarStyle: isUser ? (profile?.style ?? null) : companion.style,
        avatarSeed: isUser ? (profile?.seed ?? null) : companion.seed,
        avatarUrl: isUser ? (profile?.avatarUrl ?? null) : (companion.avatarUrl ?? null),
        authorRole: isUser ? (profile?.role ?? null) : companion.role,
        content: m.content, at: m.at, expiresAt: Math.min(companionMessageExpiresAt(m.at), companion.expiresAt),
        isGreeting: m.kind === 'greeting' && m.from === 'companion',
      }
    })
  }, [privateMessages, companion, profile, room.identity])
  const privateIds = useMemo(() => new Set(privateChatEntries.map((e) => e.id)), [privateChatEntries])
  const mergedEntries: ChatEntry[] = useMemo(() => {
    const all = [...room.entries, ...privateChatEntries]
    all.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
    return all
  }, [room.entries, privateChatEntries])
  // Merge local reactions (IndexedDB) with cloud reactions for display
  const mergedReactions = useMemo(() => {
    const selfId = room.identity?.userId ?? null
    const local = summarizeRoomReactions(localReactionRows, selfId)
    // cloud + local (local keys are companion/MUD ids, no overlap risk)
    return { ...room.reactions, ...local }
  }, [room.reactions, localReactionRows, room.identity])
  const handleLocalReact = useCallback((messageId: string, emoji: string) => {
    const selfId = room.identity?.userId
    if (!selfId) return
    const active = !localReactionRows.some(
      (r) => r.messageId === messageId && r.userId === selfId && r.emoji === emoji,
    )
    if (active) {
      const target = privateChatEntries.find((e) => e.id === messageId)
      if (target && target.userId !== selfId) recordInteraction(target.userId, target.displayName, selfId)
    }
    const change = { messageId, userId: selfId, emoji, active }
    setLocalReactionRows((prev) => applyRoomReactionChange(prev, change))
    recordEmojiUse(emoji)
    if (active) void saveLocalReaction({ messageId, userId: selfId, emoji })
    else void removeLocalReaction(messageId, selfId, emoji)
  }, [room.identity, localReactionRows, privateChatEntries])
  const handleReact = useCallback((messageId: string, emoji: string) => {
    if (privateIds.has(messageId)) handleLocalReact(messageId, emoji)
    else room.toggleReaction(messageId, emoji)
  }, [privateIds, handleLocalReact, room])
  const displayPresence = useMemo(() => { // eslint-disable-line react-hooks/preserve-manual-memoization
    if (!companion) return room.presence
    const companionMember = {
      userId: companion.id,
      displayName: companion.name,
      avatarStyle: companion.style,
      avatarSeed: companion.seed,
      avatarUrl: companion.avatarUrl ?? null,
      role: companion.role,
      profileExpiresAt: companion.expiresAt,
      enteredAt: companion.createdAt,
    }
    // Avoid duplicate if somehow already in presence
    if (room.presence.some((p) => p.userId === companion.id)) return room.presence
    return [...room.presence, companionMember]
  }, [room.presence, companion])

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

  // The backdrop follows the newest live chat photo; its slot start time is
  // the photo's own send time so every client counts down in lockstep.
  const latestChatImage = useMemo(() => {
    let result: { url: string; since: number } | null = null
    for (const entry of room.entries) {
      if (entry.expiring || entry.state) continue
      const url = entry.imageUrl ?? entry.localImage
      if (!url) continue
      result = {
        url,
        since: entry.serverCreatedAt
          ? new Date(entry.serverCreatedAt).getTime()
          : entry.at,
      }
    }
    return result
  }, [room.entries])

  const openImage = (src: string) => {
    // A click that just dismissed a popover (+ / emoji / message menu /
    // avatar / gear) only closes the popover — it must not open the
    // viewer. Same guard as the blank-area fold (see popoverGuard.ts).
    if (popoverJustClosed()) return
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
    cornerOpen ? 'is-corner-expanded' : '',
  ].join(' ')

  return (
    <div
      ref={shellRef}
      className={shellClass}
      data-countdown-animation={countdownAnimation}
      style={{ ['--veil' as string]: String(veil) }}
    >
      <BackgroundStage chatImage={latestChatImage} revealed={fold === 'folded'} onReady={markBgReady} />
      <audio
        ref={audioRef}
        preload="auto"
        playsInline
        onEnded={handleTrackEnded}
        onPlay={backgroundMusic.onPlay}
        onPause={backgroundMusic.onPause}
      />

      <TopBar
        account={account}
        profile={profile}
        // EXPERIMENT: sign-in disabled.
        // onSignIn={() => setAccountView('signin')}
        // onOpenProfile={() => setProfileOpen(true)}
        onOpenWelcome={() => setWelcomeOpen(true)}
      />

      <SettingsBar
        members={room.presence}
        theme={theme}
        countdownAnimation={countdownAnimation}
        suppressed={composerMenuOpen}
        onToggleTheme={() => window.setOneHourTheme?.(theme === 'dark' ? 'warm' : 'dark')}
        onChangeCountdownAnimation={changeCountdownAnimation}
        selfId={room.identity?.userId ?? null}
        onMemberPrivateClick={handleMemberPrivateClick}
      />

      {/* Page-corner view-background: small, top-right of the screen. */}
      {chatMounted && (
        <button
          type="button"
          className={`chat-close${fold === 'folding' ? ' is-fading' : ''}`}
          aria-label={t('查看背景图片', 'View background photo')}
          title={t('查看背景图片', 'View background photo')}
          onClick={(e) => {
            e.stopPropagation()
            closeChat()
          }}
        >
          <BackgroundImageIcon size={16} />
        </button>
      )}

      {chatMounted && (
        <button
          type="button"
          className="music-toggle"
          aria-label={musicMuted ? (t('打开音乐', 'Unmute music')) : (t('关闭音乐', 'Mute music'))}
          title={musicMuted ? (t('打开音乐', 'Unmute music')) : (t('关闭音乐', 'Mute music'))}
          onClick={(e) => {
            e.stopPropagation()
            toggleMusic()
          }}
        >
          <span
            className={`music-bars${musicPlaying && !musicMuted ? ' is-playing' : ''}`}
            aria-hidden="true"
          >
            <span />
            <span />
            <span />
            <span />
          </span>
        </button>
      )}

      {/* Mobile-only: one toggle for the whole top-right tool stack.
          Plus morphs to X while the four buttons are expanded below it. */}
      {chatMounted && (
        <button
          type="button"
          className={`corner-toggle${cornerOpen ? ' is-open' : ''}`}
          aria-label={cornerOpen ? (t('收起工具', 'Collapse tools')) : (t('展开工具', 'Expand tools'))}
          title={cornerOpen ? (t('收起工具', 'Collapse tools')) : (t('展开工具', 'Expand tools'))}
          aria-expanded={cornerOpen}
          onClick={(e) => {
            e.stopPropagation()
            setCornerOpen((v) => !v)
          }}
        >
          <PlusIcon size={16} />
        </button>
      )}

      {
        <div
          className={`chat-stage${fold === 'folded' ? ' is-hidden' : ''}`}
          onClick={(e) => {
            // Desktop: the stage showing around the column is one big
            // "fold the chat" hit target; a click that only dismissed a
            // composer popover shouldn't fold the room as well.
            if (e.target !== e.currentTarget) return
            if (composerMenuOpen || Date.now() - menuClosedAt.current < 400) return
            // A blank click that just dismissed a popover (avatar / gear /
            // message menu) only closes the popover — never anything under it.
            if (popoverJustClosed()) return
            closeChat()
          }}
        >
          <div
            className={`chat-column${
              fold === 'folding' ? ' is-folded' : fold === 'folded' ? ' is-folded is-settled' : fold === 'unfolding' ? ' is-unfolding' : ''
            }`}
          >
            <div className="chat-top-avatar-wrap">
              <ChatTopAvatar account={account} profile={profile} />
            </div>
            <MessageList
              entries={mergedEntries}
              selfId={room.identity?.userId ?? null}
              presence={displayPresence}
              isPrivateId={(id) => privateIds.has(id)}
              status={room.status}
              layoutKey={fold === 'unfolding'}
              incomingMessageSequence={room.incomingMessageSequence}
              sentMessageSequence={sentMessageSequence}
              reactions={mergedReactions}
              onImageClick={openImage}
              onRetry={room.retry}
              onRemove={(id) => {
                if (privateIds.has(id)) {
                  void removeCompanionMessage(id)
                  void removeLocalReactionsForMessage(id)
                  setPrivateMessages((prev) => prev.filter((m) => m.id !== id))
                  setLocalReactionRows((prev) => prev.filter((r) => r.messageId !== id))
                } else room.remove(id)
              }}
              onToast={showToast}
              onLoadOlder={room.loadOlder}
              onReact={handleReact}
              onReply={setReplyTo}
              companionTyping={companionTyping}
              companion={companion ? { name: companion.name, style: companion.style, seed: companion.seed, avatarUrl: companion.avatarUrl ?? null } : null}
              userTyping={userTyping}
              selfProfile={profile ? { nickname: profile.nickname, style: profile.style ?? null, seed: profile.seed ?? null, avatarUrl: profile.avatarUrl ?? null } : null}
              onEdit={handleStartEdit}
              privateMode={privateMode}
              onEnterPrivateChat={handleMemberPrivateClick}
              onOpenGames={() => setGamePickerOpen(true)}
            />

            {room.identity ? (
              <Composer
                key={editingMessage?.id ?? 'compose'}
                onSend={handleSend}
                replyTo={replyTo}
                onClearReply={() => setReplyTo(null)}
                editing={editingMessage}
                onClearEditing={() => setEditingMessage(null)}
                onEdit={handleEditMessage}
                onImagePicked={handleImagePicked}
                onImagesPicked={handleImagesPicked}
                onMenuOpenChange={handleMenuOpenChange}
                onStartGame={handleStartGame}
                onStartPoll={() => setPollOpen(true)}
                onOpenGames={() => setGamePickerOpen(true)}
                companion={companion}
                privateMode={privateMode}
                onExitPrivateChat={exitPrivateChat}
                presence={displayPresence}
                selfId={room.identity?.userId ?? null}
                onWhisperSelect={handleWhisperSelect}
                pendingInsertName={pendingInsertName}
                onConsumeInsert={consumeInsert}
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
                    {t('正在建立身份，稍候即可畅聊…', 'Setting up your identity…')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      }
      {!chatMounted && hasRevealed ? (
        <>
          {/* Click anywhere on the scene to pull the chat back out. */}
          <div
            className="chat-reopen-veil"
            onClick={openChat}
            role="button"
            aria-label={t('展开聊天', 'Open chat')}
          />
          <button type="button" className="chat-reopen-hint" onClick={openChat}>
            <ChatBubbleIcon />
            {t('展开聊天', 'Open chat')}
          </button>
        </>
      ) : null}

      {viewerIndex != null && chatImages[viewerIndex] && (
        <ImageViewer
          images={chatImages}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
      {/* EXPERIMENT: sign-in / account dialog disabled.
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
      )} */}
      {/* EXPERIMENT: profile page (sign-in dependent) disabled.
      {profileOpen && (
        <ProfilePage
          account={account}
          onClose={() => setProfileOpen(false)}
          onOpenSignIn={() => {
            setProfileOpen(false)
            setAccountView('bind')
          }}
        />
      )} */}
      {pendingSummary ? (
        <SummaryModal
          stats={pendingSummary.stats}
          presence={room.presence}
          selfId={room.identity?.userId ?? null}
          startedAt={pendingSummary.startedAt}
          onComplete={handleSummaryComplete}
          onFarewell={(userId, name, expiresAt, sentence) => {
            void userId
            room.send(`@${name} ${sentence}`, undefined, null, { expiresAt, farewell: true })
          }}
        />
      ) : (!profile || welcomeOpen) ? (
        <WelcomeModal
          mode={profile ? 'edit' : 'welcome'}
          onClose={profile ? () => setWelcomeOpen(false) : undefined}
        />
      ) : null}
      {pollOpen && !pendingSummary && profile && room.identity && (
        <CreatePollModal onClose={() => setPollOpen(false)} onSend={handleSendPoll} />
      )}
      {gamePickerOpen && !pendingSummary && profile && room.identity && (
        <GamePickerModal onSelect={handleStartGame} onClose={() => setGamePickerOpen(false)} />
      )}
      {toast && <div className="app-toast">{toast}</div>}
    </div>
  )
}
