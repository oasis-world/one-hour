import { useCallback, useEffect, useRef, useState } from 'react'
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
import { chooseAiMove } from './ai'
import { loadGomokuState, saveGomokuState } from './cloudState'
import { PaletteIcon } from '../../components/icons'
import './GomokuGame.css'
import './GomokuBoardStyles.css'

const BOARD_STYLES = ['classic', 'minimal', 'dark', 'neon', 'ocean', 'sakura', 'forest', 'retro', 'glass'] as const
type BoardStyle = (typeof BOARD_STYLES)[number]
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

  const [state, setState] = useState<GomokuState>(() => createInitialState(instanceId, hostUserId))
  const [winnerToast, setWinnerToast] = useState('')
  const winnerToastTimerRef = useRef<number | null>(null)
  const [startToast, setStartToast] = useState('')
  const startToastTimerRef = useRef<number | null>(null)
  const startToastKeyRef = useRef('')
  const hydratedRef = useRef(false)
  const prevStatusRef = useRef<GomokuState['status']>('waiting')
  const prevRoundRef = useRef(1)
  const [profileLooks, setProfileLooks] = useState<Record<string, { style: string; seed: string; url: string | null }>>({})
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [spectatorsOpen, setSpectatorsOpen] = useState(false)
  const [joinStatus, setJoinStatus] = useState<'idle' | 'joining' | 'retry'>('idle')
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
  const stateRef = useRef(state)
  const stateLoadedRef = useRef(false)
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve())
  const aiTimerRef = useRef<number | null>(null)
  const joinTimeoutRef = useRef<number | null>(null)
  const selfIdRef = useRef(selfId)
  const channelRetryCountRef = useRef(0)
  const profileLookRequestsRef = useRef(new Set<string>())
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
    winnerToastTimerRef.current = window.setTimeout(() => setWinnerToast(''), 4000)
  }, [state.status, state.winnerId, state.round, state.players])

  useEffect(() => {
    if (!selfId || state.status !== 'result') return
    const key = `${instanceId}:${state.round}`
    if (recordedRoundRef.current === key) return
    if (!state.players.some((p) => p.userId === selfId)) return
    recordedRoundRef.current = key
    recordGameResult('gomoku', selfId, state.winnerId ?? null, state.players.map((p) => p.userId))
    for (const p of state.players) {
      if (p.userId === selfId || p.isAI) continue
      recordInteraction(p.userId, p.displayName, selfId)
    }
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
  }, [])
  useEffect(() => {
    for (const player of state.players) {
      if (player.isAI || (player.avatarStyle && player.avatarSeed) || profileLookRequestsRef.current.has(player.userId)) continue
      profileLookRequestsRef.current.add(player.userId)
      void fetchCloudProfile(player.userId).then((snapshot) => {
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
    channelRef.current?.send({ type: 'broadcast', event: 'state', payload: next })
  }, [])

  const scheduleAiTurn = useCallback((next: GomokuState) => {
    const ai = next.players.find((player) => player.isAI && player.color === next.turn)
    if (!ai || next.status !== 'playing') return
    if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current)
    aiTimerRef.current = window.setTimeout(() => {
      const current = stateRef.current
      if (current.status !== 'playing' || current.turn !== ai.color) return
      const { r, c } = chooseAiMove(current.board, ai.color)
      const afterAi = tryMove(current, ai.userId, r, c)
      if (afterAi) publishState(afterAi)
    }, 350)
  }, [publishState])

  const showStartToast = useCallback(() => {
    setStartToast(t('游戏开始！', 'Game start!'))
    if (startToastTimerRef.current !== null) window.clearTimeout(startToastTimerRef.current)
    startToastTimerRef.current = window.setTimeout(() => setStartToast(''), 2500)
  }, [])

  useEffect(() => {
    if (!stateLoadedRef.current) return
    if (!hydratedRef.current) {
      hydratedRef.current = true
      startToastKeyRef.current = `${state.round}:started`
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
  }, [])

  // Only the active host writes the canonical state. Spectators and stale tabs
  // must not overwrite a newer board with an old snapshot.
  useEffect(() => {
    if (!channelReady || !selfId || selfId !== state.hostId) return
    persistQueueRef.current = persistQueueRef.current
      .catch(() => undefined)
      .then(() => saveGomokuState(instanceId, state))
  }, [channelReady, instanceId, selfId, state])

  // Browsers may suspend Realtime while the app is backgrounded. Reload the
  // durable snapshot on return so spectators and players catch up immediately.
  useEffect(() => {
    if (!channelReady) return
    let cancelled = false
    const refresh = async () => {
      const loaded = await loadGomokuState(instanceId)
      if (cancelled || !loaded.ok || !loaded.state) return
      stateRef.current = loaded.state
      setState(loaded.state)
      if (selfIdRef.current === loaded.state.hostId) {
        channelRef.current?.send({ type: 'broadcast', event: 'state', payload: loaded.state })
        scheduleAiTurn(loaded.state)
      }
    }
    const onVisible = () => {
      if (!document.hidden) void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [channelReady, instanceId, scheduleAiTurn])

  const myColor = selfId ? colorOfPlayer(state, selfId) : null
  const isMyTurn = myColor !== null && state.turn === myColor && state.status === 'playing'

  useEffect(() => {
    if (!isSupabaseConfigured() || !selfId) return
    let cancelled = false
    let stateSyncTimer: number | null = null
    let reconnectTimer: number | null = null
    let cloudStateChecked = false
    let channel: ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>['channel']> | null = null
    const retryChannel = (reason: string, error?: unknown) => {
      if (cancelled || reconnectTimer !== null) return
      console.error(`Gomoku channel ${reason}:`, error)
      setReadyChannelKey('')
      const delays = [1000, 2000, 5000, 10000]
      const delay = delays[Math.min(channelRetryCountRef.current, delays.length - 1)]
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
      channel = client.channel(`game:gomoku:${instanceId}`, {
        config: { presence: { key: selfId } },
      })
      channelRef.current = channel

      const initializeIfNeeded = () => {
        if (!cloudStateChecked || stateLoadedRef.current || cancelled) return
        const onlineUsers = Object.keys(channel?.presenceState() ?? {}).sort()
        const expectedHost = onlineUsers.includes(hostUserId)
          ? hostUserId
          : onlineUsers[0] ?? (selfId === hostUserId ? selfId : null)
        if (expectedHost !== selfId) return
        const init = createInitialState(instanceId, selfId)
        stateLoadedRef.current = true
        channelRetryCountRef.current = 0
        stateRef.current = init
        setState(init)
        setReadyChannelKey(channelKey)
        channel?.send({ type: 'broadcast', event: 'state', payload: init })
      }

      channel.on('broadcast', { event: 'state' }, ({ payload }) => {
        if (isGomokuState(payload, instanceId)) {
          if (stateSyncTimer !== null) window.clearInterval(stateSyncTimer)
          stateSyncTimer = null
          stateLoadedRef.current = true
          channelRetryCountRef.current = 0
          const prev = stateRef.current
          stateRef.current = payload
          setState(payload)
          setReadyChannelKey(channelKey)
          if (selfIdRef.current === payload.hostId) scheduleAiTurn(payload)
          reconcilePresence()
          const startKey = `${payload.round}:started`
          if (payload.status === 'playing' && payload.players.length >= 2 && startToastKeyRef.current !== startKey && (prev.status !== 'playing' || prev.round !== payload.round)) {
            startToastKeyRef.current = startKey
            showStartToast()
          }
        }
      })
      channel.on('broadcast', { event: 'state-request' }, () => {
        if (selfIdRef.current === stateRef.current.hostId && stateLoadedRef.current) {
          channel?.send({ type: 'broadcast', event: 'state', payload: stateRef.current })
        }
      })
      channel.on('broadcast', { event: 'move' }, ({ payload }) => {
        if (selfIdRef.current !== stateRef.current.hostId) return
        const p = payload as { userId?: string; r?: number; c?: number }
        if (!p?.userId || typeof p.r !== 'number' || typeof p.c !== 'number') return
        const next = tryMove(stateRef.current, p.userId, p.r, p.c)
        if (!next) return
        publishState(next)
        scheduleAiTurn(next)
      })
      channel.on('broadcast', { event: 'join' }, ({ payload }) => {
        if (selfIdRef.current !== stateRef.current.hostId) return
        const p = payload as { userId?: string; displayName?: string; avatarUrl?: string | null; avatarStyle?: string | null; avatarSeed?: string | null }
        if (!p?.userId) return
        const cur = stateRef.current
        if (cur.players.some((pl) => pl.userId === p.userId)) {
          channel?.send({ type: 'broadcast', event: 'state', payload: cur })
          return
        }
        if (cur.players.length >= 2) {
          channel?.send({ type: 'broadcast', event: 'state', payload: cur })
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
          joinedAt: Date.now(),
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
      })

      channel.on('broadcast', { event: 'ai' }, () => {
        if (selfIdRef.current !== stateRef.current.hostId) return
        const next = addAiOpponent(stateRef.current)
        if (next) {
          publishState(next)
          scheduleAiTurn(next)
        }
      })
      channel.on('broadcast', { event: 'leave' }, ({ payload }) => {
        if (selfIdRef.current !== stateRef.current.hostId) return
        const p = payload as { userId?: string }
        if (!p?.userId) return
        const next = removeGomokuPlayer(stateRef.current, p.userId)
        if (next) publishState(next)
      })
      channel.on('broadcast', { event: 'rematch' }, ({ payload }) => {
        if (selfIdRef.current !== stateRef.current.hostId) return
        const request = payload as { round?: number }
        const current = stateRef.current
        if (request?.round !== current.round) return
        const next = restartGomokuRound(current)
        publishState(next)
        scheduleAiTurn(next)
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
        const pres = channel?.presenceState() ?? {}
        const userIds = Object.keys(pres)
        let cur = stateRef.current
        if (!userIds.includes(cur.hostId)) {
          const candidates = userIds.slice().sort()
          if (candidates[0] === selfIdRef.current) {
            const next = { ...cur, hostId: selfIdRef.current as string }
            publishState(next)
            scheduleAiTurn(next)
            cur = next
          }
        }
        if (selfIdRef.current === cur.hostId) {
          // Host re-broadcasts state so late joiners / spectators catch up.
          channel?.send({ type: 'broadcast', event: 'state', payload: cur })
        }
      }
      channel.on('presence', { event: 'sync' }, reconcilePresence)

      let stateLoading = false
      let statePolling = false
      await channel.subscribe(async (status, error) => {
        if (status === 'SUBSCRIBED') {
          if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
          reconnectTimer = null
          if (stateLoading) return
          stateLoading = true
          try {
            const trackStatus = await withTimeout(channel!.track({ userId: selfId, displayName, avatarUrl, avatarStyle, avatarSeed }), 8000)
            if (trackStatus !== 'ok') throw new Error(`presence track returned ${trackStatus}`)
            channel?.send({ type: 'broadcast', event: 'state-request', payload: {} })
            if (stateSyncTimer === null) {
              stateSyncTimer = window.setInterval(() => {
                if (stateLoadedRef.current) {
                  if (stateSyncTimer !== null) window.clearInterval(stateSyncTimer)
                  stateSyncTimer = null
                  return
                }
                channel?.send({ type: 'broadcast', event: 'state-request', payload: {} })
                if (statePolling) return
                statePolling = true
                void withTimeout(loadGomokuState(instanceId), 5000)
                  .then(({ state: saved, ok }) => {
                    if (cancelled || !ok || !saved || stateLoadedRef.current) return
                    cloudStateChecked = true
                    stateLoadedRef.current = true
                    channelRetryCountRef.current = 0
                    stateRef.current = saved
                    setState(saved)
                    setReadyChannelKey(channelKey)
                    if (selfIdRef.current === saved.hostId) {
                      channel?.send({ type: 'broadcast', event: 'state', payload: saved })
                      scheduleAiTurn(saved)
                    }
                  })
                  .catch(() => undefined)
                  .finally(() => { statePolling = false })
              }, 1800)
            }
            let loaded: Awaited<ReturnType<typeof loadGomokuState>> | null = null
            for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
              try { loaded = await withTimeout(loadGomokuState(instanceId), 8000) } catch { loaded = null }
              if (loaded?.ok) break
              await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)))
            }
            if (cancelled) return
            if (!loaded?.ok) throw new Error('could not load the game state after retries')
            const saved = loaded.state
            if (saved && !stateLoadedRef.current) {
              cloudStateChecked = true
              stateLoadedRef.current = true
              channelRetryCountRef.current = 0
              stateRef.current = saved
              setState(saved)
              if (selfId === saved.hostId) {
                channel?.send({ type: 'broadcast', event: 'state', payload: saved })
                scheduleAiTurn(saved)
              }
              setReadyChannelKey(channelKey)
            } else if (stateLoadedRef.current) {
              if (selfId === stateRef.current.hostId) {
                channel?.send({ type: 'broadcast', event: 'state', payload: stateRef.current })
              }
              setReadyChannelKey(channelKey)
            } else {
              cloudStateChecked = true
            }
            reconcilePresence()
            // Players join only by clicking "Join game" — never auto-join.
          } catch (error) {
            retryChannel('initialization failed', error)
          } finally {
            stateLoading = false
          }
        } else {
          setReadyChannelKey('')
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            retryChannel(status, error)
          }
        }
      })
    })()

    return () => {
      cancelled = true
      if (stateSyncTimer !== null) window.clearInterval(stateSyncTimer)
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
      if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current)
      if (channel) void channel.unsubscribe()
      channelRef.current = null
    }
  }, [instanceId, hostUserId, selfId, displayName, avatarUrl, avatarStyle, avatarSeed, channelKey, channelAttempt, publishState, scheduleAiTurn, showStartToast])

  const sendMove = (r: number, c: number) => {
    if (!selfId) return
    if (selfId === stateRef.current.hostId) {
      const next = tryMove(stateRef.current, selfId, r, c)
      if (next) {
        publishState(next)
        scheduleAiTurn(next)
      }
    } else {
      channelRef.current?.send({ type: 'broadcast', event: 'move', payload: { userId: selfId, r, c } })
    }
  }
  const sendRematch = () => {
    if (!channelReady) return
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
      channelRef.current?.send({
        type: 'broadcast',
        event: 'rematch',
        payload: { round: stateRef.current.round },
      })
    }
  }
  const leaveRoom = () => {
    if (!selfId || !channelReady) return
    setLeaveConfirmOpen(false)
    if (selfId === stateRef.current.hostId) {
      const next = removeGomokuPlayer(stateRef.current, selfId)
      if (next) publishState(next)
    } else {
      channelRef.current?.send({ type: 'broadcast', event: 'leave', payload: { userId: selfId } })
    }
  }
  const sendJoin = () => {
    if (!selfId || !channelReady || !channelRef.current || joinStatus === 'joining') return
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
        joinedAt: Date.now(),
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
    void channelRef.current.send({
      type: 'broadcast',
      event: 'join',
      payload: { userId: selfId, displayName, avatarUrl, avatarStyle, avatarSeed },
    }).then((status) => {
      if (status !== 'ok') failJoin()
    }, failJoin)
  }

  const sendAiJoin = () => {
    if (!channelReady || !selfId || !channelRef.current) return
    if (selfId === stateRef.current.hostId) {
      const next = addAiOpponent(stateRef.current)
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
    } else {
      channelRef.current.send({ type: 'broadcast', event: 'ai', payload: {} })
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
    <div className="gomoku-card">
      <div className="gomoku-head">
        <div className="gomoku-heading">
          <span className="gomoku-title">{t('五子棋', 'Gomoku')}</span>
          <button
            type="button"
            className="gomoku-style-random"
            onClick={randomizeBoardStyle}
            aria-label={t('随机切换棋盘风格', 'Randomize board style')}
            title={t('随机切换棋盘风格', 'Randomize board style')}
          >
            <PaletteIcon size={16} />
          </button>
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
                />
              )}
            </span>
          ) : <span className="gomoku-status">{statusHint}</span>)}
        </div>
        <span className="gomoku-meta">
          {statusHint && <span className="gomoku-status-dot" aria-hidden="true" />}
          <span>{state.players.length}/2 {t('玩家', 'players')}</span>
        </span>
      </div>

      <div className="gomoku-players">
        {state.players.map((p) => (
          <div key={p.userId} className="gomoku-player-slot">
            {p.isAI ? (
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
              <span className="gomoku-player-name" title={p.displayName}>{p.displayName}</span>
              <span className="gomoku-player-score">{p.score}</span>
            </div>
          </div>
        ))}
      </div>

      {state.status === 'result' && (
        <div className="gomoku-result">{resultText()}</div>
      )}

      <div className={`gomoku-board gomoku-board--${boardStyle}`} role="grid" aria-label={t('五子棋棋盘', 'Gomoku board')}>
        <span className="gomoku-grid-lines" aria-hidden="true" />
        <span className="gomoku-frame" aria-hidden="true" />
        {winnerToast && <div className="gomoku-winner-toast" role="status" aria-live="assertive">{winnerToast}</div>}
        {startToast && <div className="gomoku-start-toast" role="status" aria-live="assertive">{startToast}</div>}
        {state.board.map((row, r) =>
          row.map((cell, c) => {
            const isWin = state.winningLine?.some(([wr, wc]) => wr === r && wc === c)
            const isLast = state.lastMove?.r === r && state.lastMove?.c === c
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                className={`gomoku-cell${isWin ? ' is-win' : ''}${isLast ? ' is-last' : ''}`}
                disabled={!isMyTurn || cell !== 0}
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
              ? t('连接游戏中…', 'Connecting…')
              : joinStatus === 'joining'
                ? t('正在加入…', 'Joining…')
                : joinStatus === 'retry'
                  ? t('加入较慢，点击重试', 'Taking longer; tap to retry')
                  : t('加入游戏', 'Join game')}
          </button>
        )}
        {canJoinAI && (
          <button type="button" className="btn-accent" disabled={!channelReady} onClick={sendAiJoin}>
            {t('与 AI 对战', 'Play vs AI')}
          </button>
        )}
        {canRestart && (
          <button type="button" className="btn-accent" disabled={!channelReady} onClick={sendRematch}>
            {t('重新开始', 'Restart')}
          </button>
        )}
        {canLeave && (
          <button type="button" className="btn-accent" disabled={!channelReady} onClick={() => setLeaveConfirmOpen(true)}>
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
              <button type="button" className="btn-accent" onClick={leaveRoom}>
                {t('离开房间', 'Leave room')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
