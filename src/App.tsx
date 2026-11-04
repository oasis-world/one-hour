import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
// EXPERIMENT: sign-in disabled.
// import AccountDialog from './components/AccountDialog'
import BackgroundStage from './components/BackgroundStage'
import Composer from './components/Composer'
import ImageViewer from './components/ImageViewer'
import MessageList from './components/MessageList'
// EXPERIMENT: profile page disabled.
// import ProfilePage from './components/ProfilePage'
import SettingsBar from './components/SettingsBar'
import TopBar from './components/TopBar'
import WelcomeModal from './components/WelcomeModal'
import SummaryModal from './components/SummaryModal'
import ChatTopAvatar from './components/ChatTopAvatar'
import { ChatBubbleIcon, ThinXIcon } from './components/icons'
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
import { useMudAutoInvite } from './lib/useMudAutoInvite'
import { isMudRecreateIntent } from './lib/mudRecreate'
import { selectMudParty } from './lib/mudSelect'
import { buildInviteText, buildMudBlueprint, buildOpeningScene } from './lib/mudTemplates'
import { requestMudScene, aiPayloadToScene } from './lib/mudGeneration'
import { createInitialMudState, saveMudState } from './games/mud/cloudState'
import { getLang } from './lib/i18n'

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
  const [privateMessages, setPrivateMessages] = useState<CompanionMessage[]>([])
  const [companionTyping, setCompanionTyping] = useState(false)
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
  const greetedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!profile || !companion || !room.identity) return
    if (privateMessages.length > 0) return
    if (greetedRef.current === companion.id) return
    const key = `one-hour-companion-greeted:${companion.id}`
    if (globalThis.localStorage?.getItem(key)) { greetedRef.current = companion.id; return }
    greetedRef.current = companion.id
    globalThis.localStorage?.setItem(key, '1')
    void (async () => {
      const text = await requestCompanionGreeting(companion)
      const msg = createCompanionReply(text)
      await saveCompanionMessage(msg)
      setPrivateMessages((prev) => [...prev, msg])
      setSentMessageSequence((s) => s + 1)
    })()
  }, [profile, companion, privateMessages.length, room.identity])

  // MUD auto-invite is wired after displayPresence is defined (see below)

  const handleSummaryComplete = () => {
    if (currentUserId) expireUserMessages(currentUserId)
    expireAnonymousProfile(currentUserId)
    clearCompanionProfile()
    void clearCompanionMessages()
    setPrivateMessages([])
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

  const triggerMudRecreate = async () => {
    if (!companion || !room.identity) return
    const presence = displayPresence ?? room.presence
    const party = selectMudParty(presence, room.identity.userId, companion.id)
    if (!party || party.length < 2) {
      const tip = createCompanionReply(t('在线小伙伴还不够2人，稍后再试试吧～', 'Not enough online friends yet (need 2+) — try again soon!'))
      await saveCompanionMessage(tip)
      setPrivateMessages((prev) => [...prev, tip])
      setSentMessageSequence((s) => s + 1)
      return
    }
    const lang = getLang()
    const isZh = lang.startsWith('zh')
    const inviteText = buildInviteText(party, companion.name, isZh)
    try { room.send(inviteText) } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/purity -- triggered by user action, not render
    const instanceId = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const blueprint = buildMudBlueprint(party)
    let scene = buildOpeningScene(blueprint, party, lang)
    try { const ai = await requestMudScene(blueprint, party, lang); if (ai) scene = aiPayloadToScene(ai) } catch { /* fallback */ }
    const invited = party.map((p) => ({ userId: p.userId, displayName: p.displayName, role: p.role ?? '' }))
    const state = createInitialMudState(instanceId, room.identity.userId, invited, blueprint, scene, lang)
    const title = isZh ? blueprint.title : blueprint.titleEn
    const cardText = `🎮 ${title}\n__GAME__:mud:${instanceId}`
    try { room.send(cardText) } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 400))
    try { await saveMudState(instanceId, state) } catch { /* ignore */ }
    // Clear auto-invite flag so next recreate can also fire freely
    try { localStorage.removeItem(`one-hour-mud-invited:${companion.id}`) } catch { /* ignore */ }
    const sys = createCompanionReply(t(`已为你重新创建《${blueprint.title}》冒险！`, `Recreated "${blueprint.titleEn}" adventure for you!`))
    await saveCompanionMessage(sys)
    setPrivateMessages((prev) => [...prev, sys])
    setSentMessageSequence((s) => s + 1)
  }

  const sendPrivateAndReply = async (text: string) => {
    if (!companion) return
    if (isMudRecreateIntent(text)) {
      const userMsg = createUserCompanionMessage(text)
      await saveCompanionMessage(userMsg)
      setPrivateMessages((prev) => [...prev, userMsg])
      setSentMessageSequence((s) => s + 1)
      setReplyTo(null)
      await triggerMudRecreate()
      return
    }
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
        const sys = createCompanionReply(t(`已为你创建${gameTitle(result.game, t)}对局，助手已加入`, `Created ${gameTitle(result.game, t)} — your companion has joined`))
        await saveCompanionMessage(sys)
        setPrivateMessages((prev) => [...prev, sys])
      }
    } catch (e) { console.warn('[companion] reply failed', e) }
    finally { setCompanionTyping(false) }
  }

  const handleSend = (text: string, reply?: MessageReply | null) => {
    if (companion && containsCompanionMention(text, companion)) {
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

  const handleEditMessage = (id: string, text: string) => {
    room.edit(id, text)
    setEditingMessage(null)
  }

  const handleImagePicked = async (file: File) => {
    try {
      const blob = await withTimeout(fileToChatImage(file), 60_000)
      room.send('', blob, replyTo)
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
        room.send('', blob, replyForNext)
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
      }
    })
  }, [privateMessages, companion, profile, room.identity])
  const privateIds = useMemo(() => new Set(privateChatEntries.map((e) => e.id)), [privateChatEntries])
  const mergedEntries: ChatEntry[] = useMemo(() => {
    const all = [...room.entries, ...privateChatEntries]
    all.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
    return all
  }, [room.entries, privateChatEntries])
  const displayPresence = useMemo(() => {
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

  useMudAutoInvite(profile, companion, displayPresence, room.entries, room.send, room.status, room.identity, fold, hasRevealed) // eslint-disable-line react-hooks/preserve-manual-memoization

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
      />

      {/* Page-corner close: small, top-right of the screen. */}
      {chatMounted && (
        <button
          type="button"
          className={`chat-close${fold === 'folding' ? ' is-fading' : ''}`}
          aria-label={t('收起聊天', 'Hide chat')}
          title={t('收起聊天', 'Hide chat')}
          onClick={(e) => {
            e.stopPropagation()
            closeChat()
          }}
        >
          <ThinXIcon size={13} />
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
              reactions={room.reactions}
              onImageClick={openImage}
              onRetry={room.retry}
              onRemove={(id) => {
                if (privateIds.has(id)) {
                  void removeCompanionMessage(id)
                  setPrivateMessages((prev) => prev.filter((m) => m.id !== id))
                } else room.remove(id)
              }}
              onToast={showToast}
              onLoadOlder={room.loadOlder}
              onReact={room.toggleReaction}
              onReply={setReplyTo}
              companionTyping={companionTyping}
              companion={companion ? { name: companion.name, style: companion.style, seed: companion.seed, avatarUrl: companion.avatarUrl ?? null } : null}
              onEdit={handleStartEdit}
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
                companion={companion}
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
      {toast && <div className="app-toast">{toast}</div>}
    </div>
  )
}
