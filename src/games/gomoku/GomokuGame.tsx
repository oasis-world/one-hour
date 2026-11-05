import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '../../lib/supabaseClient'
import { isSupabaseConfigured } from '../../lib/supabaseConfig'
import { useAccount } from '../../lib/useAccount'
import { fetchCloudProfile } from '../../lib/profileCloud'
import { loadUserProfile } from '../../lib/userProfile'
import { recordGameResult, recordInteraction } from '../../lib/lifetimeStats'
import { resolveChatIdentity } from '../../lib/identity'
import { t, useLang } from '../../lib/i18n'
import AvatarBadge from '../../components/AvatarBadge'
import OnlineList from '../../components/OnlineList'
import type { PresenceMember } from '../../lib/chatTypes'
import { setPopoverOpen } from '../../lib/popoverGuard'
import { withTimeout } from '../../lib/withTimeout'
import { acquireGameChannelSlot, canSendGameBroadcast, getGamePresenceKey, getGamePresenceUsers, installGameWakeRecovery, isGameHostAuthority, pokeGameSocket, removeStaleGameChannel, sendGameBroadcast, watchGameChannelClose } from '../realtime'
import { chooseAiMove } from './ai'
import { requestCloudMove } from '../cloudAi'
import { buildGomokuHints } from './cloudHints'
import AiSourceIcon from '../AiSourceIcon'
import { AiThinkingTimer } from '../AiThinkingTimer'
import GameCardMenu from '../GameCardMenu'
import { getCachedAiMode, setCachedAiMode } from '../aiModePreference'
import { loadGomokuState, saveGomokuState } from './cloudState'
import { GomokuIcon } from '../../components/icons'
import './GomokuGame.css'
import './GomokuBoardStyles.css'
import '../GameCardMenu.css'

const BOARD_STYLES = ['classic', 'minimal', 'dark', 'neon', 'ocean', 'sakura', 'forest', 'retro', 'glass'] as const
type BoardStyle = (typeof BOARD_STYLES)[number]
const currentTimestamp = () => Date.now()
import {
  addAiOpponent,
  colorOfPlayer,
  createInitialState,
  emptyBoard,
  isGomokuState,
  removeGomokuPlayer,
  restartGomokuRound,
  tryMove,
  type GomokuState,
} from './logic'

interface Props {
  instanceId: string
  hostUserId: string
  onlineMembers?: PresenceMember[]
}

export default function GomokuGame({ instanceId, hostUserId, onlineMembers = [] }: Props) {
  useLang()
  const account = useAccount()
  const identity = resolveChatIdentity(account)
  const profile = loadUserProfile()
  const displayName = profile?.nickname ?? identity?.displayName ?? 'Player'
  const avatarUrl = profile?.avatarUrl ?? identity?.avatarUrl ?? null
  const avatarStyle = profile?.style ?? identity?.avatar?.style ?? null
  const avatarSeed = profile?.seed ?? identity?.avatar?.seed ?? null
  const selfId = identity?.userId ?? null
  const presenceKey = getGamePresenceKey(selfId ?? '')

  const [state, setState] = useState<GomokuState>(() => createInitialState(instanceId, hostUserId))
  const [winnerToast, setWinnerToast] = useState('')
  const winnerToastTimerRef = useRef<number | null>(null)
  const [startToast, setStartToast] = useState('')
  const startToastTimerRef = useRef<number | null>(null)
  const startToastKeyRef = useRef('')
  const [hintToast, setHintToast] = useState('')
  const hintToastTimerRef = useRef<number | null>(null)
  const hydratedRef = useRef(false)
  const prevStatusRef = useRef<GomokuState['status']>('waiting')
  const prevRoundRef = useRef(1)
  const [profileLooks, setProfileLooks] = useState<Record<string, { style: string; seed: string; url: string | null }>>({})
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [spectatorsOpen, setSpectatorsOpen] = useState(false)
  const [joinStatus, setJoinStatus] = useState<'idle' | 'joining' | 'retry'>('idle')
  const headerRef=useRef<HTMLDivElement>(null)
  const [spectatorHOffset,setSpectatorHOffset]=useState(0)
  useLayoutEffect(()=>{
    if(!spectatorsOpen)return
    const update=()=>{
      const header=headerRef.current
      const chat=document.querySelector('.chat-column') as HTMLElement | null
      if(!header||!chat)return
      const hr=header.getBoundingClientRect()
      const cr=chat.getBoundingClientRect()
      setSpectatorHOffset(Math.round((cr.left+cr.width/2)-(hr.left+hr.width/2)))
    }
    update()
    window.addEventListener('resize',update)
    return ()=>window.removeEventListener('resize',update)
  },[spectatorsOpen])
  useEffect(() => {
    if (!spectatorsOpen) return
    setPopoverOpen(true)
    return () => setPopoverOpen(false)
  }, [spectatorsOpen])
  const [boardStyle, setBoardStyle] = useState<BoardStyle>('classic')
  const randomizeBoardStyle = useCallback(() => {
    setBoardStyle((prev) => {
      if (BOARD_STYLES.length <= 1) return prev
      let next = prev
      while (next === prev) next = BOARD_STYLES[Math.floor(Math.random() * BOARD_STYLES.length)]
      return next
    })
  }, [])
  const [readyChannelKey, setReadyChannelKey] = useState('')
  const [channelAttempt, setChannelAttempt] = useState(0)
  const channelKey = `${instanceId}:${selfId ?? ''}:${displayName}:${avatarUrl ?? ''}:${avatarStyle ?? ''}:${avatarSeed ?? ''}`
  const channelReady = readyChannelKey === channelKey
  const channelRef = useRef<ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>['channel']> | null>(null)
  const supabaseClientRef = useRef<Awaited<ReturnType<typeof getSupabaseClient>> | null>(null)
  const stateRef = useRef(state)
  const stateLoadedRef = useRef(false)
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve())
  const aiTimerRef = useRef<number | null>(null)
  const joinTimeoutRef = useRef<number | null>(null)
  const selfIdRef = useRef(selfId)
  const channelRetryCountRef = useRef(0)
  const profileLookRequestsRef = useRef(new Set<string>())
  const profileLookControllerRef = useRef(new AbortController())
  const winnerToastKeyRef = useRef('')
  const recordedRoundRef = useRef('')
  useEffect(() => {
    stateRef.current = state
  }, [state])
  useEffect(() => {
    selfIdRef.current = selfId
  }, [selfId])
  useEffect(() => {
    if (state.status !== 'result' || !state.winnerId) {
      winnerToastKeyRef.current = ''
      return
    }
    const toastKey = `${state.round}:${state.winnerId}`
    if (winnerToastKeyRef.current === toastKey) return
    winnerToastKeyRef.current = toastKey
    const winner = state.players.find((player) => player.userId === state.winnerId)?.displayName ?? 'Player'
    setWinnerToast(t('{{winner}} 获胜！', '{{winner}} wins!').replace('{{winner}}', winner))
    if (winnerToastTimerRef.current !== null) window.clearTimeout(winnerToastTimerRef.current)
    winnerToastTimerRef.current = window.setTimeout(() => setWinnerToast(''), 2000)
  }, [state.status, state.winnerId, state.round, state.players])

  useEffect(() => {
    if (!selfId || !state.players.some((player) => player.userId === selfId)) return
    for (const player of state.players) {
      if (player.userId === selfId || player.isAI) continue
      recordInteraction(player.userId, player.displayName, selfId)
    }
  }, [selfId, state.players])

  useEffect(() => {
    if (!selfId || state.status !== 'result') return
    const key = `${instanceId}:${state.round}`
    if (recordedRoundRef.current === key) return
    if (!state.players.some((p) => p.userId === selfId)) return
    recordedRoundRef.current = key
    recordGameResult('gomoku', selfId, state.winnerId ?? null, state.players.map((p) => p.userId))
  }, [instanceId, selfId, state.status, state.round, state.winnerId, state.players])
  useEffect(() => {
    if (!selfId || !state.players.some((player) => player.userId === selfId)) return
    if (joinTimeoutRef.current !== null) window.clearTimeout(joinTimeoutRef.current)
    joinTimeoutRef.current = null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJoinStatus('idle')
  }, [selfId, state.players])
  useEffect(() => () => {
    if (joinTimeoutRef.current !== null) window.clearTimeout(joinTimeoutRef.current)
    profileLookControllerRef.current.abort()
  }, [])
  useEffect(() => {
    for (const player of state.players) {
      if (player.isAI || (player.avatarStyle && player.avatarSeed) || profileLookRequestsRef.current.has(player.userId)) continue
      profileLookRequestsRef.current.add(player.userId)
      void fetchCloudProfile(player.userId, profileLookControllerRef.current.signal).then((snapshot) => {
        if (!snapshot) return
        setProfileLooks((current) => ({
          ...current,
          [player.userId]: {
            style: snapshot.profile.style,
            seed: snapshot.profile.seed,
            url: snapshot.profile.avatarUrl ?? null,
          },
        }))
      })
    }
  }, [state.players])

  const publishState = useCallback((next: GomokuState) => {
    stateRef.current = next
    setState(next)
    sendGameBroadcast(channelRef.current, 'state', next)
  }, [])

  const scheduleAiTurn = useCallback((next: GomokuState) => {
    const ai = next.players.find((player) => player.isAI && player.color === next.turn)
    if (!ai || next.status !== 'playing') return
    if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current)
    aiTimerRef.current = window.setTimeout(async () => {
      if (!isGameHostAuthority(channelRef.current, next.hostId) || !canSendGameBroadcast(channelRef.current)) return
      const current = stateRef.current
      if (current.status !== 'playing' || current.turn !== ai.color) return
      const legalMoves = current.board.flatMap((row, r) => row.flatMap((cell, c) => cell === 0 ? [{ r, c }] : []))
      const { annotatedMoves: gomokuHints, threatSummary: gomokuThreat } = buildGomokuHints(current.board, current.turn, legalMoves)
      const position = { board: current.board, turn: current.turn, round: current.round, lastMove: current.lastMove, history: (current.moveHistory ?? []).slice(-12), threatSummary: gomokuThreat, annotatedMoves: gomokuHints }
      let move: { r: number; c: number } | null = null
      if ((current.aiMode ?? 'local') === 'cloud') {
        try { move = await requestCloudMove('gomoku', current.instanceId, position, legalMoves, () => isGameHostAuthority(channelRef.current, current.hostId) && canSendGameBroadcast(channelRef.current)) } catch { /* use local AI */ }
      }
      if (stateRef.current !== current || !isGameHostAuthority(channelRef.current, current.hostId)) return
      const candidate = move && current.board[move.r]?.[move.c] === 0 ? move : null
      const afterCandidate = candidate ? tryMove(current, ai.userId, candidate.r, candidate.c) : null
      const fallback = afterCandidate ? null : chooseAiMove(current.board, ai.color)
      const afterAi = afterCandidate ?? (fallback ? tryMove(current, ai.userId, fallback.r, fallback.c) : null)
      if (afterAi) {
        if (!afterCandidate) console.info('[game-ai] Applying local AI move for gomoku.')
        publishState({ ...afterAi, aiSource: afterCandidate ? 'cloud' : 'local' })
      }
    }, 350)
  }, [publishState])

  const showStartToast = useCallback(() => {
    setStartToast(t('游戏开始', 'Game start'))
    if (startToastTimerRef.current !== null) window.clearTimeout(startToastTimerRef.current)
    startToastTimerRef.current = window.setTimeout(() => setStartToast(''), 2000)
  }, [])

  const showHintToast = useCallback((msg: string) => {
    setHintToast(msg)
    if (hintToastTimerRef.current !== null) window.clearTimeout(hintToastTimerRef.current)
    hintToastTimerRef.current = window.setTimeout(() => setHintToast(''), 2000)
  }, [])

  useEffect(() => {
    if (!stateLoadedRef.current) return
    if (!hydratedRef.current) {
      hydratedRef.current = true
      if (state.status === 'playing' && state.players.length >= 2) {
        startToastKeyRef.current = `${state.round}:started`
      } else {
        startToastKeyRef.current = ''
      }
      prevStatusRef.current = state.status
      prevRoundRef.current = state.round
      return
    }
    if (state.status !== 'playing' || state.players.length < 2) {
      prevStatusRef.current = state.status
      prevRoundRef.current = state.round
      return
    }
    const startKey = `${state.round}:started`
    const isTransition = prevStatusRef.current !== 'playing' || prevRoundRef.current !== state.round
    if (startToastKeyRef.current !== startKey && isTransition) {
      startToastKeyRef.current = startKey
      showStartToast()
    }
    prevStatusRef.current = state.status
    prevRoundRef.current = state.round
  }, [state.status, state.round, state.players.length, showStartToast])

  useEffect(() => () => {
    if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current)
    if (winnerToastTimerRef.current !== null) window.clearTimeout(winnerToastTimerRef.current)
    if (startToastTimerRef.current !== null) window.clearTimeout(startToastTimerRef.current)
    if (hintToastTimerRef.current !== null) window.clearTimeout(hintToastTimerRef.current)
  }, [])

  // Only the elected host tab writes canonical state; sibling tabs and
  // spectators must not overwrite it with stale snapshots.
  useEffect(() => {
    if (!channelReady || !selfId || selfId !== state.hostId || !isGameHostAuthority(channelRef.current, state.hostId)) return
    persistQueueRef.current = persistQueueRef.current
      .catch(() => undefined)
      .then(() => saveGomokuState(instanceId, state, () => canSendGameBroadcast(channelRef.current)))
  }, [channelReady, instanceId, selfId, state])

  const myColor = selfId ? colorOfPlayer(state, selfId) : null
  const isMyTurn = myColor !== null && state.turn === myColor && state.status === 'playing'
  const isRealtimeReady = () => channelReady && canSendGameBroadcast(channelRef.current)

  useEffect(() => {
    if (!isSupabaseConfigured() || !selfId) return
    let cancelled = false
    let stateSyncTimer: number | null = null
    let cloudPollTimer: number | null = null
    let reconnectTimer: number | null = null
    let channelStableTimer: number | null = null
    let cloudStateChecked = false
    const cloudRequestController = new AbortController()
    const channelSlotController = new AbortController()
    let releaseChannelSlot: (() => void) | null = null
    let channel: ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>['channel']> | null = null
    let supabaseClient: Awaited<ReturnType<typeof getSupabaseClient>> | null = null
    let wakeCleanup: (() => void) | null = null
    const releaseSlot = () => {
      const release = releaseChannelSlot
      releaseChannelSlot = null
      release?.()
    }
    const retryChannel = (reason: string, error?: unknown) => {
      if (cancelled || reconnectTimer !== null) return
      if (channelStableTimer !== null) window.clearTimeout(channelStableTimer)
      channelStableTimer = null
      if (stateSyncTimer !== null) window.clearInterval(stateSyncTimer)
      stateSyncTimer = null
      if (cloudPollTimer !== null) window.clearTimeout(cloudPollTimer)
      cloudPollTimer = null
      if (joinTimeoutRef.current !== null) window.clearTimeout(joinTimeoutRef.current)
      joinTimeoutRef.current = null
      setJoinStatus((status) => status === 'joining' ? 'retry' : status)
      setReadyChannelKey('')
      const delays = [1000, 2000, 5000, 10000, 15000]
      const baseDelay = delays[Math.min(channelRetryCountRef.current, delays.length - 1)]
      const delay = Math.round(baseDelay * (0.8 + Math.random() * 0.4))
      console.warn(`Gomoku channel ${reason}; retrying in ${delay}ms`, {
        instanceId,
        attempt: channelRetryCountRef.current + 1,
        channelState: channel?.state ?? 'not created',
        socketConnected: channel?.socket.isConnected() ?? false,
        visibility: document.visibilityState,
        error,
      })
      channelRetryCountRef.current++
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        if (!cancelled) setChannelAttempt((attempt) => attempt + 1)
      }, delay)
    }

    void (async () => {
      const client = await getSupabaseClient().catch((error: unknown) => {
        retryChannel('client initialization failed', error)
        return null
      })
      if (!client || cancelled) return
      supabaseClient = client
      supabaseClientRef.current = client
      releaseChannelSlot = await acquireGameChannelSlot(channelSlotController.signal)
      if (!releaseChannelSlot || cancelled) {
        releaseSlot()
        return
      }
      const topic = `game:gomoku:${instanceId}`
      await removeStaleGameChannel(client, topic)
      if (cancelled) {
        releaseSlot()
        return
      }
      channel = client.channel(topic, {
        config: { presence: { key: presenceKey } },
      })
      channelRef.current = channel
      watchGameChannelClose(channel, 'Gomoku', instanceId, () => !cancelled)
      // Opportunistically heal a stale socket left by iOS background suspend.
      pokeGameSocket(client, channel)
      // Wake-up healing: iOS background kills the WebSocket without a CLOSED event.
      wakeCleanup = installGameWakeRecovery({
        getChannel: () => channelRef.current,
        getClient: () => supabaseClient,
        shouldCheck: () => !cancelled,
        onStale: (reason) => retryChannel(reason),
      })

      const initializeIfNeeded = () => {
        if (!cloudStateChecked || stateLoadedRef.current || cancelled) return
        const onlineUsers = getGamePresenceUsers(channel)
        const expectedHost = onlineUsers.includes(hostUserId)
          ? hostUserId
          : onlineUsers[0] ?? (selfId === hostUserId ? selfId : null)
        if (expectedHost !== selfId || !isGameHostAuthority(channel, selfId)) return
        const init = createInitialState(instanceId, selfId)
        stateLoadedRef.current = true
        stateRef.current = init
        setState(init)
        setReadyChannelKey(channelKey)
        sendGameBroadcast(channel, 'state', init)
      }

      channel.on('broadcast', { event: 'state' }, ({ payload }) => {
        if (!cancelled && canSendGameBroadcast(channel) && isGomokuState(payload, instanceId)) {
          if (stateSyncTimer !== null) window.clearInterval(stateSyncTimer)
          stateSyncTimer = null
          stateLoadedRef.current = true
          const prev = stateRef.current
          stateRef.current = payload
          setState(payload)
          setReadyChannelKey(channelKey)
          if (isGameHostAuthority(channel, payload.hostId)) scheduleAiTurn(payload)
          reconcilePresence()
          const startKey = `${payload.round}:started`
          if (payload.status === 'playing' && payload.players.length >= 2 && startToastKeyRef.current !== startKey && (prev.status !== 'playing' || prev.round !== payload.round)) {
            startToastKeyRef.current = startKey
            showStartToast()
          }
        }
      })
      channel.on('broadcast', { event: 'state-request' }, () => {
        if (selfIdRef.current === stateRef.current.hostId && isGameHostAuthority(channel, stateRef.current.hostId) && stateLoadedRef.current) {
          sendGameBroadcast(channel, 'state', stateRef.current)
        }
      })
      channel.on('broadcast', { event: 'move' }, ({ payload }) => {
        if (selfIdRef.current !== stateRef.current.hostId || !isGameHostAuthority(channel, stateRef.current.hostId)) return
        const p = payload as { userId?: string; r?: number; c?: number }
        if (!p?.userId || typeof p.r !== 'number' || typeof p.c !== 'number') return
        const next = tryMove(stateRef.current, p.userId, p.r, p.c)
        if (!next) return
        publishState(next)
        scheduleAiTurn(next)
      })
      channel.on('broadcast', { event: 'join' }, ({ payload }) => {
        if (selfIdRef.current !== stateRef.current.hostId || !isGameHostAuthority(channel, stateRef.current.hostId)) return
        const p = payload as { userId?: string; displayName?: string; avatarUrl?: string | null; avatarStyle?: string | null; avatarSeed?: string | null }
        if (!p?.userId) return
        const cur = stateRef.current
        if (cur.players.some((pl) => pl.userId === p.userId)) {
          sendGameBroadcast(channel, 'state', cur)
          return
        }
        if (cur.players.length >= 2) {
          sendGameBroadcast(channel, 'state', cur)
          return
        }
        const restarting = cur.status === 'result'
        const round = cur.round + (cur.status === 'result' ? 1 : 0)
        const basePlayers = cur.players
        const color: 1 | 2 = cur.players.some((pl) => pl.color === 1) ? 2 : 1
        const existingScore = cur.players.find((pl) => pl.userId === p.userId)?.score ?? 0
        const newPlayer = {
          userId: p.userId,
          displayName: p.displayName ?? 'Player',
          avatarUrl: p.avatarUrl ?? null,
          avatarStyle: p.avatarStyle ?? null,
          avatarSeed: p.avatarSeed ?? null,
          color,
          score: existingScore,
          joinedAt: currentTimestamp(),
        }
        const nextPlayers = [...basePlayers, newPlayer]
        const next: GomokuState = {
          ...cur,
          board: restarting ? emptyBoard() : cur.board,
          turn: restarting ? (round % 2 === 1 ? 1 : 2) : cur.turn,
          winnerId: restarting ? null : cur.winnerId,
          winningLine: restarting ? null : cur.winningLine,
          lastMove: restarting ? null : cur.lastMove,
          round,
          players: nextPlayers,
          status: nextPlayers.length >= 2 ? 'playing' : 'waiting',
        }
        publishState(next)
        if (next.status === 'playing' && next.players.length >= 2) {
          const startKey = `${next.round}:started`
          if (startToastKeyRef.current !== startKey) {
            startToastKeyRef.current = startKey
            showStartToast()
          }
        }
      })

      channel.on('broadcast', { event: 'ai' }, () => {
        if (selfIdRef.current !== stateRef.current.hostId || !isGameHostAuthority(channel, stateRef.current.hostId)) return
        const raw = addAiOpponent(stateRef.current)
        const cached = getCachedAiMode()
        const next = raw && cached ? { ...raw, aiMode: cached } : raw
        if (next) {
          publishState(next)
          scheduleAiTurn(next)
          if (next.status === 'playing' && next.players.length >= 2) {
            const startKey = `${next.round}:started`
            if (startToastKeyRef.current !== startKey) {
              startToastKeyRef.current = startKey
              showStartToast()
            }
          }
        }
      })
      channel.on('broadcast', { event: 'ai-mode' }, ({ payload }) => {
        if (selfIdRef.current !== stateRef.current.hostId || !isGameHostAuthority(channel, stateRef.current.hostId)) return
        const mode = (payload as { mode?: unknown } | null)?.mode
        if (mode !== 'cloud' && mode !== 'local') return
        setCachedAiMode(mode)
        const next = { ...stateRef.current, aiMode: mode as 'cloud' | 'local' }
        publishState(next)
        scheduleAiTurn(next)
      })
      channel.on('broadcast', { event: 'leave' }, ({ payload }) => {
        if (selfIdRef.current !== stateRef.current.hostId || !isGameHostAuthority(channel, stateRef.current.hostId)) return
        const p = payload as { userId?: string }
        if (!p?.userId) return
        const next = removeGomokuPlayer(stateRef.current, p.userId)
        if (next) publishState(next)
      })
      channel.on('broadcast', { event: 'rematch' }, ({ payload }) => {
        if (selfIdRef.current !== stateRef.current.hostId || !isGameHostAuthority(channel, stateRef.current.hostId)) return
        const request = payload as { round?: number }
        const current = stateRef.current
        if (request?.round !== current.round) return
        const next = restartGomokuRound(current)
        publishState(next)
        scheduleAiTurn(next)
        if (next.status === 'playing' && next.players.length >= 2) {
          const startKey = `${next.round}:started`
          if (startToastKeyRef.current !== startKey) {
            startToastKeyRef.current = startKey
            showStartToast()
          }
        }
      })

      const reconcilePresence = () => {
        const activeLooks: Record<string, { style: string; seed: string; url: string | null }> = {}
        for (const metas of Object.values(channel?.presenceState() ?? {})) {
          for (const meta of metas as Array<Record<string, unknown>>) {
            if (typeof meta.userId !== 'string') continue
            activeLooks[meta.userId] = {
              style: typeof meta.avatarStyle === 'string' ? meta.avatarStyle : '',
              seed: typeof meta.avatarSeed === 'string' ? meta.avatarSeed : '',
              url: typeof meta.avatarUrl === 'string' ? meta.avatarUrl : null,
            }
          }
        }
        setProfileLooks((current) => ({ ...activeLooks, ...current }))
        if (!stateLoadedRef.current) {
          initializeIfNeeded()
          return
        }
        const userIds = getGamePresenceUsers(channel)
        let cur = stateRef.current
        if (!userIds.includes(cur.hostId)) {
          const candidates = userIds.slice().sort()
          if (candidates[0] === selfIdRef.current && isGameHostAuthority(channel, selfIdRef.current)) {
            const next = { ...cur, hostId: selfIdRef.current as string }
            publishState(next)
            scheduleAiTurn(next)
            cur = next
          }
        }
        if (selfIdRef.current === cur.hostId && isGameHostAuthority(channel, cur.hostId)) {
          // Host re-broadcasts state so late joiners / spectators catch up.
          sendGameBroadcast(channel, 'state', cur)
          scheduleAiTurn(cur)
        }
      }
      channel.on('presence', { event: 'sync' }, reconcilePresence)

      let stateLoading = false
      let statePolling = false
      let cloudPollAttempt = 0
      const scheduleCloudStateLoad = (delay: number) => {
        if (cancelled || stateLoadedRef.current || cloudStateChecked) return
        if (cloudPollTimer !== null) window.clearTimeout(cloudPollTimer)
        cloudPollTimer = window.setTimeout(() => {
          cloudPollTimer = null
          if (cancelled || statePolling || stateLoadedRef.current) return
          statePolling = true
          const requestController = new AbortController()
          const abortRequest = () => requestController.abort()
          cloudRequestController.signal.addEventListener('abort', abortRequest, { once: true })
          void withTimeout(loadGomokuState(instanceId, requestController.signal), 5000)
            .then(({ state: saved, ok }) => {
              if (!ok) throw new Error('could not load the game state')
              if (cancelled || stateLoadedRef.current) return
              cloudStateChecked = true
              cloudPollAttempt = 0
              if (saved) {
                stateLoadedRef.current = true
                stateRef.current = saved
                setState(saved)
                if (selfIdRef.current === saved.hostId && isGameHostAuthority(channel, saved.hostId) && canSendGameBroadcast(channel)) {
                  sendGameBroadcast(channel, 'state', saved)
                  scheduleAiTurn(saved)
                }
                if (canSendGameBroadcast(channel)) setReadyChannelKey(channelKey)
              } else if (canSendGameBroadcast(channel)) {
                reconcilePresence()
              }
            })
            .catch(() => {
              if (cancelled || stateLoadedRef.current || cloudStateChecked) return
              const delays = [1000, 2000, 5000, 10000]
              const nextDelay = delays[Math.min(cloudPollAttempt, delays.length - 1)]
              cloudPollAttempt++
              scheduleCloudStateLoad(nextDelay)
            })
            .finally(() => {
              requestController.abort()
              cloudRequestController.signal.removeEventListener('abort', abortRequest)
              statePolling = false
            })
        }, delay)
      }
      // Hydrate the visible board independently of Realtime subscription
      // latency; the channel will publish/catch up as soon as it is ready.
      scheduleCloudStateLoad(0)
      await channel.subscribe(async (status, error) => {
        if (status === 'SUBSCRIBED') {
          if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
          reconnectTimer = null
          if (channelStableTimer !== null) window.clearTimeout(channelStableTimer)
          channelStableTimer = window.setTimeout(() => {
            channelRetryCountRef.current = 0
            channelStableTimer = null
          }, 30000)
          if (stateLoading) return
          stateLoading = true
          try {
            const trackStatus = await withTimeout(channel!.track({ userId: selfId, displayName, avatarUrl, avatarStyle, avatarSeed }), 8000)
            if (cancelled || !canSendGameBroadcast(channel)) return
            if (trackStatus !== 'ok') throw new Error(`presence track returned ${trackStatus}`)
            sendGameBroadcast(channel, 'state-request', {})
            if (stateSyncTimer === null) {
              stateSyncTimer = window.setInterval(() => {
                if (stateLoadedRef.current) {
                  if (stateSyncTimer !== null) window.clearInterval(stateSyncTimer)
                  stateSyncTimer = null
                  return
                }
                if (!canSendGameBroadcast(channel)) {
                  if (stateSyncTimer !== null) window.clearInterval(stateSyncTimer)
                  stateSyncTimer = null
                  return
                }
                sendGameBroadcast(channel, 'state-request', {})
              }, 1800)
            }
            if (stateLoadedRef.current) {
              if (selfId === stateRef.current.hostId && isGameHostAuthority(channel, stateRef.current.hostId)) {
                sendGameBroadcast(channel, 'state', stateRef.current)
                scheduleAiTurn(stateRef.current)
              }
              setReadyChannelKey(channelKey)
            }
            // Players join only by clicking "Join game" — never auto-join.
          } catch (error) {
            retryChannel('initialization failed', error)
          } finally {
            stateLoading = false
          }
        } else {
          if (cancelled) return
          setReadyChannelKey('')
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            retryChannel(status, error)
          } else if (stateSyncTimer !== null) {
            window.clearInterval(stateSyncTimer)
            stateSyncTimer = null
          }
        }
      })
    })()

    return () => {
      cancelled = true
      wakeCleanup?.()
      cloudRequestController.abort()
      channelSlotController.abort()
      if (stateSyncTimer !== null) window.clearInterval(stateSyncTimer)
      if (cloudPollTimer !== null) window.clearTimeout(cloudPollTimer)
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
      if (channelStableTimer !== null) window.clearTimeout(channelStableTimer)
      if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current)
      channelRef.current = null
      if (channel) {
        void channel.unsubscribe(1500).catch(() => undefined).finally(() => {
          channel?.teardown()
          releaseSlot()
        })
      } else {
        releaseSlot()
      }
    }
  }, [instanceId, hostUserId, selfId, displayName, avatarUrl, avatarStyle, avatarSeed, channelKey, channelAttempt, presenceKey, publishState, scheduleAiTurn, showStartToast])

  const sendMove = (r: number, c: number) => {
    if (!selfId || !isRealtimeReady()) return
    if (selfId === stateRef.current.hostId) {
      const next = tryMove(stateRef.current, selfId, r, c)
      if (next) {
        publishState(next)
        scheduleAiTurn(next)
      }
    } else {
      sendGameBroadcast(channelRef.current, 'move', { userId: selfId, r, c })
    }
  }
  const sendRematch = () => {
    if (!selfId || !isRealtimeReady()) return
    if (selfId === stateRef.current.hostId) {
      const next = restartGomokuRound(stateRef.current)
      publishState(next)
      scheduleAiTurn(next)
      if (next.status === 'playing' && next.players.length >= 2) {
        const startKey = `${next.round}:started`
        if (startToastKeyRef.current !== startKey) {
          startToastKeyRef.current = startKey
          showStartToast()
        }
      }
    } else {
      sendGameBroadcast(channelRef.current, 'rematch', { round: stateRef.current.round })
    }
  }
  const leaveRoom = () => {
    if (!selfId || !isRealtimeReady()) return
    setLeaveConfirmOpen(false)
    if (selfId === stateRef.current.hostId) {
      const next = removeGomokuPlayer(stateRef.current, selfId)
      if (next) publishState(next)
    } else {
      sendGameBroadcast(channelRef.current, 'leave', { userId: selfId })
    }
  }
  const sendJoin = () => {
    if (!selfId || joinStatus === 'joining') return
    if (!isRealtimeReady()) {
      // Try to heal the socket immediately — the user explicitly tapped join.
      const ch = channelRef.current
      if (ch && supabaseClientRef.current) pokeGameSocket(supabaseClientRef.current, ch)
      setJoinStatus('retry')
      return
    }
    setJoinStatus('joining')
    if (selfId === stateRef.current.hostId) {
      // The host does not receive its own broadcast, so apply locally.
      const cur = stateRef.current
      if (cur.players.some((pl) => pl.userId === selfId)) {
        setJoinStatus('idle')
        return
      }
      if (cur.players.length >= 2) {
        setJoinStatus('retry')
        return
      }
      const color: 1 | 2 = cur.players.some((player) => player.color === 1) ? 2 : 1
      const restarting = cur.status === 'result'
      const round = cur.round + (cur.status === 'result' ? 1 : 0)
      const newPlayer = {
        userId: selfId as string,
        displayName,
        avatarUrl,
        avatarStyle,
        avatarSeed,
        color,
        score: 0,
        joinedAt: currentTimestamp(),
      }
      const next: GomokuState = {
        ...cur,
        board: restarting ? emptyBoard() : cur.board,
        turn: restarting ? (round % 2 === 1 ? 1 : 2) : cur.turn,
        winnerId: restarting ? null : cur.winnerId,
        winningLine: restarting ? null : cur.winningLine,
        lastMove: restarting ? null : cur.lastMove,
        round,
        players: [...cur.players, newPlayer],
        status: cur.players.length + 1 >= 2 ? 'playing' : 'waiting',
      }
      publishState(next)
      if (next.status === 'playing' && next.players.length >= 2) {
        const startKey = `${next.round}:started`
        if (startToastKeyRef.current !== startKey) {
          startToastKeyRef.current = startKey
          showStartToast()
        }
      }
      return
    }
    const failJoin = () => {
      if (stateRef.current.players.some((player) => player.userId === selfId)) return
      if (joinTimeoutRef.current !== null) window.clearTimeout(joinTimeoutRef.current)
      joinTimeoutRef.current = null
      setJoinStatus('retry')
    }
    joinTimeoutRef.current = window.setTimeout(failJoin, 10000)
    const channel = channelRef.current
    if (!canSendGameBroadcast(channel)) {
      failJoin()
      return
    }
    void channel.send({
      type: 'broadcast',
      event: 'join',
      payload: { userId: selfId, displayName, avatarUrl, avatarStyle, avatarSeed },
    }).then((status) => {
      if (status !== 'ok') failJoin()
    }, failJoin)
  }

  const sendAiJoin = () => {
    if (!selfId || !isRealtimeReady()) return
    if (selfId === stateRef.current.hostId) {
      const raw = addAiOpponent(stateRef.current)
      if (raw) {
        const cached = getCachedAiMode()
        const next = cached ? { ...raw, aiMode: cached } : raw
        publishState(next)
        scheduleAiTurn(next)
        if (next.status === 'playing' && next.players.length >= 2) {
          const startKey = `${next.round}:started`
          if (startToastKeyRef.current !== startKey) {
            startToastKeyRef.current = startKey
            showStartToast()
          }
        }
      }
    } else {
      sendGameBroadcast(channelRef.current, 'ai', {})
    }
  }

  const changeAiMode = (aiMode: 'cloud' | 'local') => {
    setCachedAiMode(aiMode)
    const current = stateRef.current
    if (!selfId || !canSendGameBroadcast(channelRef.current)) return
    if (!current.players.some((p) => p.isAI)) return
    if (current.aiMode === aiMode) return
    const next = { ...current, aiMode }
    if (current.hostId === selfId) {
      if (isGameHostAuthority(channelRef.current, current.hostId)) {
        publishState(next)
        scheduleAiTurn(next)
      } else sendGameBroadcast(channelRef.current, 'ai-mode', { mode: aiMode })
    } else {
      sendGameBroadcast(channelRef.current, 'ai-mode', { mode: aiMode })
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="gomoku-card">
        <p className="gomoku-empty">{t('游戏需要联网（Supabase）', 'Games require an online connection')}</p>
      </div>
    )
  }

  const isPlayer = myColor !== null
  const spectators = onlineMembers.filter((member) => !state.players.some((player) => player.userId === member.userId))
  const canJoin = !isPlayer && state.players.length < 2 && (state.status === 'waiting' || state.status === 'result')
  const canJoinAI = isPlayer && state.players.length === 1 && state.status === 'waiting'
  const hasAiOpponent = state.players.some((player) => player.isAI)
  const aiIsThinking = state.status === 'playing' && state.players.some((player) => player.isAI && player.color === state.turn)
  const hasHumanOpponent = state.players.some((player) => !player.isAI && player.userId !== selfId)
  const waitingSolo = state.status === 'waiting' && state.players.length === 1
  const canRestart = isPlayer && (hasAiOpponent || state.status === 'result')
  const canLeave = isPlayer && (
    hasHumanOpponent
    || hasAiOpponent
    || waitingSolo
  )
  const statusHint = state.status === 'waiting'
    ? state.players.length === 0
      ? t('等待玩家加入', 'Waiting for player')
      : isPlayer
        ? t('等待玩家', 'Waiting for player')
        : t('欢迎你加入', "You're welcome to join")
    : state.status === 'playing'
      ? isPlayer
        ? isMyTurn ? t('轮到你了', 'Your turn') : t('等待对手', 'Waiting for opponent')
        : t('观战中', 'Spectating')
      : ''

  const resultText = () => {
    if (state.status !== 'result') return ''
    if (state.winnerId) {
      const w = state.players.find((p) => p.userId === state.winnerId)
      return t('获胜：', 'Winner: ') + (w?.displayName ?? '')
    }
    return t('平局', 'Draw')
  }

  return (
    <div className={`gomoku-card${spectatorsOpen ? ' has-spectator-pop' : ''}`}>
      <div ref={headerRef} className="gomoku-head">
        <div className="gomoku-heading">
          <span className="gomoku-title"><GomokuIcon size={17} />{t('五子棋', 'Gomoku')}</span>
          {statusHint && (state.status === 'playing' && !isPlayer ? (
            <span className="gomoku-spectator-control">
              <button
                type="button"
                className="gomoku-status gomoku-spectator-trigger"
                aria-haspopup="dialog"
                aria-expanded={spectatorsOpen}
                onClick={() => setSpectatorsOpen((open) => !open)}
              >
                <span>{statusHint}{spectators.length > 0 ? ` (${spectators.length > 99 ? '99+' : spectators.length})` : ''}</span>
              </button>
              {spectatorsOpen && (
                <OnlineList
                  members={spectators}
                  placement="bottom"
                  className="gomoku-spectator-pop"
                  title={t('观战玩家', 'Spectators')}
                  emptyText={t('暂无观战玩家', 'No spectators currently')}
                  ownerSelector=".gomoku-spectator-control"
                  onClose={() => setSpectatorsOpen(false)}
                  style={spectatorHOffset ? { marginLeft: spectatorHOffset } : undefined}
                />
              )}
            </span>
          ) : <span className="gomoku-status">{statusHint}</span>)}
        </div>
        <span className="gomoku-meta">
          {statusHint && <span className="gomoku-status-dot" aria-hidden="true" />}
          <span>{state.players.length}/2 {t('玩家', 'players')}</span>
        </span>
        {state.status === 'playing' && isPlayer && (
          <GameCardMenu
            aiMode={state.aiMode ?? state.aiSource ?? getCachedAiMode() ?? 'local'}
            onChangeAiMode={changeAiMode}
            onToggleBoardStyle={randomizeBoardStyle}
            onAiTutor={() => showHintToast(t('AI 教学功能敬请期待', 'AI Tutor coming soon'))}
          />
        )}
      </div>

      <div className="gomoku-players">
        {state.players.map((p) => (
          <div key={p.userId} className="gomoku-player-slot">
            {(p.isAI && !p.avatarStyle && !p.avatarSeed && !p.avatarUrl) ? (
              <span className="gomoku-ai-avatar" aria-label="AI">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3v3M9 3h6M7 8h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Z" />
                  <path d="M8.5 13h.01M15.5 13h.01M9 17h6" />
                </svg>
              </span>
            ) : (
              <AvatarBadge
                className="gomoku-player-avatar"
                size={30}
                look={{
                  style: p.avatarStyle || profileLooks[p.userId]?.style || 'thumbs',
                  seed: p.avatarSeed || profileLooks[p.userId]?.seed || p.userId,
                  url: p.avatarUrl ?? profileLooks[p.userId]?.url,
                }}
              />
            )}
            <div className={`gomoku-player${p.userId === selfId ? ' is-self' : ''}${state.turn === p.color && state.status === 'playing' ? ' is-turn' : ''}`}>
              <span className="gomoku-stone" data-color={p.color} />
              <span className="gomoku-player-name" title={p.displayName}><span className="gomoku-player-name-text">{p.displayName}</span>{p.isAI && <AiSourceIcon source={state.aiMode ?? state.aiSource ?? 'local'} />}{p.isAI && <AiThinkingTimer active={aiIsThinking && p.color === state.turn} />}</span>
              <span className="gomoku-player-score">{p.score}</span>
            </div>
          </div>
        ))}
      </div>


      <div className="gomoku-result">{state.status === 'result' ? resultText() : ''}</div>

      <div className={`gomoku-board gomoku-board--${boardStyle}`} role="grid" aria-label={t('五子棋棋盘', 'Gomoku board')}>
        <span className="gomoku-grid-lines" aria-hidden="true" />
        <span className="gomoku-frame" aria-hidden="true" />
        {winnerToast && <div className="gomoku-winner-toast" role="status" aria-live="assertive">{winnerToast}</div>}
        {startToast && <div className="gomoku-start-toast" role="status" aria-live="assertive">{startToast}</div>}
        {hintToast && <div className="gomoku-start-toast" role="status" aria-live="assertive">{hintToast}</div>}
        {state.board.map((row, r) =>
          row.map((cell, c) => {
            const isWin = state.winningLine?.some(([wr, wc]) => wr === r && wc === c)
            const isLast = state.lastMove?.r === r && state.lastMove?.c === c
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                className={`gomoku-cell${isWin ? ' is-win' : ''}${isLast ? ' is-last' : ''}`}
                disabled={!channelReady || !isMyTurn || cell !== 0}
                onClick={() => isMyTurn && cell === 0 && sendMove(r, c)}
                aria-label={`${r + 1},${c + 1}`}
              >
                {cell !== 0 && <span className="gomoku-stone-onboard" data-color={cell} />}
              </button>
            )
          }),
        )}
      </div>

      <div className="gomoku-actions">
        {canJoin && (
          <button
            type="button"
            className="btn-accent"
            disabled={!channelReady || !selfId || joinStatus === 'joining'}
            aria-busy={joinStatus === 'joining'}
            onClick={sendJoin}
          >
            {!channelReady || !selfId
              ? t('重新连接中…', 'Reconnecting…')
              : joinStatus === 'joining'
                ? t('正在加入…', 'Joining…')
                : joinStatus === 'retry'
                  ? t('加入较慢，点击重试', 'Taking longer; tap to retry')
                  : t('加入游戏', 'Join game')}
          </button>
        )}
        {canJoinAI && (
          <button type="button" className="btn-accent" disabled={!channelReady || !selfId} onClick={sendAiJoin}>
            {t('与 AI 对战', 'Play vs AI')}
          </button>
        )}
        {canRestart && (
          <button type="button" className="btn-accent" disabled={!channelReady || !selfId} onClick={sendRematch}>
            {t('重新开始', 'Restart')}
          </button>
        )}
        {canLeave && (
          <button type="button" className="btn-accent" disabled={!channelReady || !selfId} onClick={() => setLeaveConfirmOpen(true)}>
            {t('离开房间', 'Leave room')}
          </button>
        )}
      </div>

      {leaveConfirmOpen && (
        <div className="gomoku-confirm-backdrop" onClick={() => setLeaveConfirmOpen(false)}>
          <div className="gomoku-confirm" role="alertdialog" aria-modal="true" aria-labelledby="gomoku-confirm-title" onClick={(event) => event.stopPropagation()}>
            <h3 id="gomoku-confirm-title">{t('离开这场对局？', 'Leave this game?')}</h3>
            <p>{t('离开后棋盘会重置，你可以之后重新加入。', 'The board will reset when you leave. You can join again later.')}</p>
            <div className="gomoku-confirm-actions">
              <button type="button" className="gomoku-confirm-cancel" onClick={() => setLeaveConfirmOpen(false)}>
                {t('继续游戏', 'Stay')}
              </button>
              <button type="button" className="btn-accent" disabled={!channelReady} onClick={leaveRoom}>
                {t('离开房间', 'Leave room')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
