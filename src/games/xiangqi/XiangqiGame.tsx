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
import { chooseAiMove } from './ai'
import { loadXiangqiState, saveXiangqiState } from './cloudState'
import { PaletteIcon } from '../../components/icons'
import './XiangqiGame.css'
import {
  addAiOpponent,
  colorOfPlayer,
  createInitialState,
  initialBoard,
  isXiangqiState,
  legalMoves,
  normalizeAiColors,
  pieceSide,
  removeXiangqiPlayer,
  restartXiangqiRound,
  sideOfColor,
  tryMove,
  inCheck,
  type Move,
  type XiangqiState,
} from './logic'

interface Props {
  instanceId: string
  hostUserId: string
  onlineMembers?: PresenceMember[]
}

const BOARD_STYLES = ['wood', 'classic', 'concave', 'jade'] as const
type BoardStyle = (typeof BOARD_STYLES)[number]

const PIECE_GLYPH: Record<number, string> = {
  1: '帥', 2: '仕', 3: '相', 4: '馬', 5: '車', 6: '砲', 7: '兵',
  [-1]: '將', [-2]: '士', [-3]: '象', [-4]: '馬', [-5]: '車', [-6]: '炮', [-7]: '卒',
}
const currentTimestamp = () => Date.now()

export default function XiangqiGame({ instanceId, hostUserId, onlineMembers = [] }: Props) {
  useLang()
  const account = useAccount()
  const identity = resolveChatIdentity(account)
  const profile = loadUserProfile()
  const displayName = profile?.nickname ?? identity?.displayName ?? 'Player'
  const avatarUrl = profile?.avatarUrl ?? identity?.avatarUrl ?? null
  const avatarStyle = profile?.style ?? identity?.avatar?.style ?? null
  const avatarSeed = profile?.seed ?? identity?.avatar?.seed ?? null
  const selfId = identity?.userId ?? null

  const [state, setState] = useState<XiangqiState>(() => createInitialState(instanceId, hostUserId))
  const [captureToast, setCaptureToast] = useState('')
  const [captureToastIsCheck, setCaptureToastIsCheck] = useState(false)
  const [captureToastIsWinner, setCaptureToastIsWinner] = useState(false)
  const captureToastTimerRef = useRef<number | null>(null)
  const [profileLooks, setProfileLooks] = useState<Record<string, { style: string; seed: string; url: string | null }>>({})
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [spectatorsOpen, setSpectatorsOpen] = useState(false)
  const [joinStatus, setJoinStatus] = useState<'idle' | 'joining' | 'retry'>('idle')
  useEffect(() => {
    if (!spectatorsOpen) return
    setPopoverOpen(true)
    return () => setPopoverOpen(false)
  }, [spectatorsOpen])
  const [selected, setSelected] = useState<[number, number] | null>(null)
  const [legalTargets, setLegalTargets] = useState<Set<string>>(new Set())
  const [boardStyle, setBoardStyle] = useState<BoardStyle>('wood')
  const randomizeBoardStyle = useCallback(() => {
    setBoardStyle((prev) => {
      if (BOARD_STYLES.length <= 1) return prev
      let next = prev
      while (next === prev) next = BOARD_STYLES[Math.floor(Math.random() * BOARD_STYLES.length)]
      return next
    })
  }, [])
  const [readyKey, setReadyKey] = useState('')
  const [channelAttempt, setChannelAttempt] = useState(0)
  const channelKey = `${instanceId}:${selfId ?? ''}:${displayName}:${avatarUrl ?? ''}:${avatarStyle ?? ''}:${avatarSeed ?? ''}`
  const channelReady = readyKey === channelKey
  const channelRef = useRef<ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>['channel']> | null>(null)
  const boardElementRef = useRef<HTMLDivElement>(null)
  const renderedBoardRef = useRef(state.board)
  const moveAnimationCleanupRef = useRef<(() => void) | null>(null)
  const stateRef = useRef(state)
  const stateLoadedRef = useRef(false)
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve())
  const aiTimerRef = useRef<number | null>(null)
  const aiWorkerRef = useRef<Worker | null>(null)
  const aiWorkerRequestRef = useRef(0)
  const aiWorkerPendingRef = useRef(new Map<number, { resolve: (move: Move | null) => void; timer: number }>())
  const joinTimeoutRef = useRef<number | null>(null)
  const selfIdRef = useRef(selfId)
  const channelRetryCountRef = useRef(0)
  const profileLookRequestsRef = useRef(new Set<string>())
  const recordedRoundRef = useRef('')
  const myColor = selfId ? colorOfPlayer(state, selfId) : null
  const currentBoard = state.board
  const currentLastMove = state.lastMove
  useLayoutEffect(() => {
    const beforeBoard = renderedBoardRef.current
    renderedBoardRef.current = currentBoard
    const move = currentLastMove
    if (!move || beforeBoard[move.from[0]]?.[move.from[1]] === 0) return
    const [fromR, fromC] = move.from
    const [toR, toC] = move.to
    const movingPiece = beforeBoard[fromR]?.[fromC]
    if (!movingPiece || currentBoard[fromR]?.[fromC] !== 0 || currentBoard[toR]?.[toC] !== movingPiece) return
    const board = boardElementRef.current
    if (!board) return
    const cells = board.querySelectorAll<HTMLButtonElement>('.xiangqi-cell')
    const fromCell = Array.from(cells).find((cell) => cell.dataset.cell === `${fromR}-${fromC}`)
    const toCell = Array.from(cells).find((cell) => cell.dataset.cell === `${toR}-${toC}`)
    const targetPiece = toCell?.querySelector<HTMLElement>('.xiangqi-piece')
    if (!fromCell || !toCell || !targetPiece) return

    moveAnimationCleanupRef.current?.()
    const boardRect = board.getBoundingClientRect()
    const fromRect = fromCell.getBoundingClientRect()
    const toRect = toCell.getBoundingClientRect()
    const pieceRect = targetPiece.getBoundingClientRect()
    const flipped = board.classList.contains('xiangqi-board--flipped')
    const startX = fromRect.left + fromRect.width / 2 - boardRect.left - pieceRect.width / 2
    const fromCenterY = fromRect.top + fromRect.height / 2 - boardRect.top
    const startY = (flipped ? boardRect.height - fromCenterY : fromCenterY) - pieceRect.height / 2
    const deltaX = toRect.left - fromRect.left
    const deltaY = (toRect.top - fromRect.top) * (flipped ? -1 : 1)
    const originalOpacity = targetPiece.style.opacity
    const ghost = document.createElement('span')
    ghost.className = `xiangqi-piece xiangqi-moving-piece ${movingPiece > 0 ? 'is-red' : 'is-black'}`
    ghost.textContent = PIECE_GLYPH[movingPiece]
    Object.assign(ghost.style, {
      left: `${startX}px`, top: `${startY}px`, width: `${pieceRect.width}px`, height: `${pieceRect.height}px`,
    })
    targetPiece.style.opacity = '0'
    board.append(ghost)
    const upright = flipped ? ' scaleY(-1)' : ''
    const animation = ghost.animate(
      [
        { transform: `translate(0, 0) scale(.96)${upright}` },
        { transform: `translate(${deltaX}px, ${deltaY}px) scale(1)${upright}` },
      ],
      { duration: 420, easing: 'cubic-bezier(.2, .72, .28, 1)', fill: 'forwards' },
    )
    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      animation.cancel()
      ghost.remove()
      targetPiece.style.opacity = originalOpacity
      if (moveAnimationCleanupRef.current === cleanup) moveAnimationCleanupRef.current = null
    }
    animation.onfinish = cleanup
    moveAnimationCleanupRef.current = cleanup
    return cleanup
  }, [currentBoard, currentLastMove, myColor])
  const announceCapture = useCallback((before: XiangqiState, after: XiangqiState) => {
    if (before.status !== 'result' && after.status === 'result' && after.winnerId) {
      const winner = after.players.find((player) => player.userId === after.winnerId)?.displayName ?? 'Player'
      const template = t('{{winner}} 获胜！', '{{winner}} wins!')
      setCaptureToast(template.replace('{{winner}}', winner))
      setCaptureToastIsCheck(false)
      setCaptureToastIsWinner(true)
      if (captureToastTimerRef.current !== null) window.clearTimeout(captureToastTimerRef.current)
      captureToastTimerRef.current = window.setTimeout(() => setCaptureToast(''), 4000)
      return
    }
    const move = after.lastMove
    if (!move) return
    const [fromR, fromC] = move.from
    const [toR, toC] = move.to
    const captured = before.board[toR]?.[toC]
    const movedPiece = before.board[fromR]?.[fromC]
    if (!movedPiece || after.board[fromR]?.[fromC] !== 0 || after.board[toR]?.[toC] !== movedPiece) return
    const checkedSide = before.turn === 1 ? 'black' : 'red'
    if (inCheck(after.board, checkedSide)) {
      setCaptureToast(t('将军！危险！', 'CHECK! King in danger!'))
      setCaptureToastIsCheck(true)
      setCaptureToastIsWinner(false)
      if (captureToastTimerRef.current !== null) window.clearTimeout(captureToastTimerRef.current)
      captureToastTimerRef.current = window.setTimeout(() => setCaptureToast(''), 4000)
      return
    }
    if (!captured) return
    const attacker = before.players.find((player) => player.color === before.turn)?.displayName ?? (before.turn === 1 ? '红方' : '黑方')
    const victim = before.players.find((player) => player.color !== before.turn)?.displayName ?? (before.turn === 1 ? '黑方' : '红方')
    const template = t('{{attacker}} 吃掉了 {{victim}} 的 {{piece}}', '{{attacker}} captured {{victim}}’s {{piece}}')
    setCaptureToast(template.replace('{{attacker}}', attacker).replace('{{victim}}', victim).replace('{{piece}}', PIECE_GLYPH[captured]))
    setCaptureToastIsCheck(false)
    setCaptureToastIsWinner(false)
    if (captureToastTimerRef.current !== null) window.clearTimeout(captureToastTimerRef.current)
    captureToastTimerRef.current = window.setTimeout(() => setCaptureToast(''), 3400)
  }, [])
  useEffect(() => { stateRef.current = state }, [state])

  useEffect(() => {
    if (!selfId || state.status !== 'result') return
    const key = `${instanceId}:${state.round}`
    if (recordedRoundRef.current === key) return
    if (!state.players.some((p) => p.userId === selfId)) return
    recordedRoundRef.current = key
    recordGameResult('xiangqi', selfId, state.winnerId ?? null, state.players.map((p) => p.userId))
    for (const p of state.players) {
      if (p.userId === selfId || p.isAI) continue
      recordInteraction(p.userId, p.displayName, selfId)
    }
  }, [instanceId, selfId, state.status, state.round, state.winnerId, state.players])
  useEffect(() => { selfIdRef.current = selfId }, [selfId])
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
    let worker: Worker
    try {
      worker = new Worker(new URL('./ai/worker.ts', import.meta.url), { type: 'module' })
    } catch {
      return
    }
    aiWorkerRef.current = worker
    worker.onmessage = (event: MessageEvent<{ id: number; move: Move | null }>) => {
      const pending = aiWorkerPendingRef.current.get(event.data.id)
      if (!pending) return
      window.clearTimeout(pending.timer)
      aiWorkerPendingRef.current.delete(event.data.id)
      pending.resolve(event.data.move)
    }
    const failPending = () => {
      for (const pending of aiWorkerPendingRef.current.values()) {
        window.clearTimeout(pending.timer)
        pending.resolve(null)
      }
      aiWorkerPendingRef.current.clear()
    }
    worker.onerror = failPending
    return () => {
      failPending()
      worker.terminate()
      if (aiWorkerRef.current === worker) aiWorkerRef.current = null
    }
  }, [])
  useEffect(() => {
    for (const player of state.players) {
      if (player.isAI || (player.avatarStyle && player.avatarSeed) || profileLookRequestsRef.current.has(player.userId)) continue
      profileLookRequestsRef.current.add(player.userId)
      void fetchCloudProfile(player.userId).then((snapshot) => {
        if (!snapshot) return
        setProfileLooks((current) => ({
          ...current,
          [player.userId]: { style: snapshot.profile.style, seed: snapshot.profile.seed, url: snapshot.profile.avatarUrl ?? null },
        }))
      })
    }
  }, [state.players])

  const publishState = useCallback((next: XiangqiState) => {
    stateRef.current = next
    setState(next)
    channelRef.current?.send({ type: 'broadcast', event: 'state', payload: next })
  }, [])

  const requestAiMove = useCallback((board: number[][], color: 1 | 2) => {
    const worker = aiWorkerRef.current
    if (!worker) return Promise.resolve(chooseAiMove(board, color, 1200))
    const id = ++aiWorkerRequestRef.current
    return new Promise<Move | null>((resolve) => {
      const timer = window.setTimeout(() => {
        aiWorkerPendingRef.current.delete(id)
        resolve(null)
      }, 12000)
      aiWorkerPendingRef.current.set(id, { resolve, timer })
      try {
        worker.postMessage({ id, board, color, timeLimitMs: 2800 })
      } catch {
        window.clearTimeout(timer)
        aiWorkerPendingRef.current.delete(id)
        resolve(chooseAiMove(board, color, 1200))
      }
    })
  }, [])

  const scheduleAiTurn = useCallback((next: XiangqiState) => {
    const ai = next.players.find((player) => player.isAI && player.color === next.turn)
    if (!ai || next.status !== 'playing') return
    if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current)
    aiTimerRef.current = window.setTimeout(async () => {
      const current = stateRef.current
      if (current.status !== 'playing') return
      const aiP = current.players.find((player) => player.isAI && player.color === current.turn)
      if (!aiP || current.turn !== aiP.color) return
      const move = await requestAiMove(current.board, aiP.color)
      if (stateRef.current !== current) return
      const selectedMove = move ?? chooseAiMove(current.board, aiP.color, 1000)
      if (!selectedMove) return
      const afterAi = tryMove(current, aiP.userId, selectedMove.from[0], selectedMove.from[1], selectedMove.to[0], selectedMove.to[1])
      if (afterAi) { announceCapture(current, afterAi); publishState(afterAi) }
    }, 400)
  }, [announceCapture, publishState, requestAiMove])

  useEffect(() => () => {
    if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current)
    if (captureToastTimerRef.current !== null) window.clearTimeout(captureToastTimerRef.current)
  }, [])

  useEffect(() => {
    if (!channelReady || !selfId || selfId !== state.hostId) return
    persistQueueRef.current = persistQueueRef.current.catch(() => undefined).then(() => saveXiangqiState(instanceId, state))
  }, [channelReady, instanceId, selfId, state])

  useEffect(() => {
    if (!channelReady) return
    let cancelled = false
    const refresh = async () => {
      const loaded = await loadXiangqiState(instanceId)
      if (cancelled || !loaded.ok || !loaded.state) return
      stateRef.current = loaded.state
      setState(loaded.state)
      if (selfIdRef.current === loaded.state.hostId) {
        channelRef.current?.send({ type: 'broadcast', event: 'state', payload: loaded.state })
        scheduleAiTurn(loaded.state)
      }
    }
    const onVisible = () => { if (!document.hidden) void refresh() }
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
      console.error(`Xiangqi channel ${reason}:`, error)
      setReadyKey('')
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
      channel = client.channel(`game:xiangqi:${instanceId}`, { config: { presence: { key: selfId } } })
      channelRef.current = channel

      const initializeIfNeeded = () => {
        if (!cloudStateChecked || stateLoadedRef.current || cancelled) return
        const onlineUsers = Object.keys(channel?.presenceState() ?? {}).sort()
        const expectedHost = onlineUsers.includes(hostUserId) ? hostUserId : (onlineUsers[0] ?? (selfId === hostUserId ? selfId : null))
        if (expectedHost !== selfId) return
        const init = createInitialState(instanceId, selfId)
        stateLoadedRef.current = true
        channelRetryCountRef.current = 0
        stateRef.current = init
        setState(init)
        setReadyKey(channelKey)
        channel?.send({ type: 'broadcast', event: 'state', payload: init })
      }

      channel.on('broadcast', { event: 'state' }, ({ payload }: { payload: unknown }) => {
        if (isXiangqiState(payload, instanceId)) {
          if (stateSyncTimer !== null) window.clearInterval(stateSyncTimer)
          stateSyncTimer = null
          const normalized = normalizeAiColors(payload)
          announceCapture(stateRef.current, normalized)
          stateLoadedRef.current = true
          channelRetryCountRef.current = 0
          stateRef.current = normalized
          setState(normalized)
          setReadyKey(channelKey)
          if (selfIdRef.current === normalized.hostId) scheduleAiTurn(normalized)
          reconcilePresence()
        }
      })
      channel.on('broadcast', { event: 'state-request' }, () => {
        if (selfIdRef.current === stateRef.current.hostId && stateLoadedRef.current) {
          channel?.send({ type: 'broadcast', event: 'state', payload: stateRef.current })
        }
      })
      channel.on('broadcast', { event: 'move' }, ({ payload }: { payload: unknown }) => {
        if (selfIdRef.current !== stateRef.current.hostId) return
        const p = payload as { userId?: string; fromR?: number; fromC?: number; toR?: number; toC?: number }
        if (!p?.userId || typeof p.fromR !== 'number') return
        const next = tryMove(stateRef.current, p.userId, p.fromR, p.fromC!, p.toR!, p.toC!)
        if (!next) return
        announceCapture(stateRef.current, next)
        publishState(next)
        scheduleAiTurn(next)
      })
      channel.on('broadcast', { event: 'join' }, ({ payload }: { payload: unknown }) => {
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
        const color: 1 | 2 = cur.players.some((pl) => pl.color === 1) ? 2 : 1
        const newPlayer = {
          userId: p.userId,
          displayName: p.displayName ?? 'Player',
          avatarUrl: p.avatarUrl ?? null,
          avatarStyle: p.avatarStyle ?? null,
          avatarSeed: p.avatarSeed ?? null,
          color,
          score: 0,
          joinedAt: Date.now(),
        }
        const next: XiangqiState = {
          ...cur,
          board: restarting ? initialBoard() : cur.board,
          turn: restarting ? (round % 2 === 1 ? 1 : 2) : cur.turn,
          winnerId: restarting ? null : cur.winnerId,
          lastMove: restarting ? null : cur.lastMove,
          round,
          players: [...cur.players, newPlayer],
          status: cur.players.length + 1 >= 2 ? 'playing' : 'waiting',
        }
        publishState(next)
      })
      channel.on('broadcast', { event: 'ai' }, () => {
        if (selfIdRef.current !== stateRef.current.hostId) return
        const next = addAiOpponent(stateRef.current)
        if (next) { publishState(next); scheduleAiTurn(next) }
      })
      channel.on('broadcast', { event: 'leave' }, ({ payload }: { payload: unknown }) => {
        if (selfIdRef.current !== stateRef.current.hostId) return
        const p = payload as { userId?: string }
        if (!p?.userId) return
        const next = removeXiangqiPlayer(stateRef.current, p.userId)
        if (next) publishState(next)
      })
      channel.on('broadcast', { event: 'rematch' }, ({ payload }: { payload: unknown }) => {
        if (selfIdRef.current !== stateRef.current.hostId) return
        const request = payload as { round?: number }
        const current = stateRef.current
        if (request?.round !== current.round) return
        const next = restartXiangqiRound(current)
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
        if (!stateLoadedRef.current) { initializeIfNeeded(); return }
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
          channel?.send({ type: 'broadcast', event: 'state', payload: cur })
        }
      }
      channel.on('presence', { event: 'sync' }, reconcilePresence)

      let stateLoading = false
      let statePolling = false
      await channel.subscribe(async (status: string, error) => {
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
                void withTimeout(loadXiangqiState(instanceId), 5000)
                  .then(({ state: saved, ok }) => {
                    if (cancelled || !ok || !saved || stateLoadedRef.current) return
                    const normalized = normalizeAiColors(saved)
                    cloudStateChecked = true
                    stateLoadedRef.current = true
                    channelRetryCountRef.current = 0
                    stateRef.current = normalized
                    setState(normalized)
                    setReadyKey(channelKey)
                    if (selfIdRef.current === normalized.hostId) {
                      channel?.send({ type: 'broadcast', event: 'state', payload: normalized })
                      scheduleAiTurn(normalized)
                    }
                  })
                  .catch(() => undefined)
                  .finally(() => { statePolling = false })
              }, 1800)
            }
            let loaded: Awaited<ReturnType<typeof loadXiangqiState>> | null = null
            for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
              try { loaded = await withTimeout(loadXiangqiState(instanceId), 8000) } catch { loaded = null }
              if (loaded?.ok) break
              await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)))
            }
            if (cancelled) return
            if (!loaded?.ok) throw new Error('could not load the game state after retries')
            const saved = loaded.state
            if (saved && !stateLoadedRef.current) {
              const normalized = normalizeAiColors(saved)
              cloudStateChecked = true
              stateLoadedRef.current = true
              channelRetryCountRef.current = 0
              stateRef.current = normalized
              setState(normalized)
              if (selfId === normalized.hostId) {
                channel?.send({ type: 'broadcast', event: 'state', payload: normalized })
                scheduleAiTurn(normalized)
              }
              setReadyKey(channelKey)
            } else if (stateLoadedRef.current) {
              if (selfId === stateRef.current.hostId) channel?.send({ type: 'broadcast', event: 'state', payload: stateRef.current })
              setReadyKey(channelKey)
            } else {
              cloudStateChecked = true
            }
            reconcilePresence()
          } catch (error) {
            retryChannel('initialization failed', error)
          } finally {
            stateLoading = false
          }
        } else {
          setReadyKey('')
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
  }, [instanceId, hostUserId, selfId, displayName, avatarUrl, avatarStyle, avatarSeed, channelKey, channelAttempt, announceCapture, publishState, scheduleAiTurn])

  const sendMove = (fromR: number, fromC: number, toR: number, toC: number) => {
    if (!selfId) return
    if (selfId === stateRef.current.hostId) {
      const next = tryMove(stateRef.current, selfId, fromR, fromC, toR, toC)
      if (next) { announceCapture(stateRef.current, next); publishState(next); scheduleAiTurn(next) }
    } else {
      channelRef.current?.send({ type: 'broadcast', event: 'move', payload: { userId: selfId, fromR, fromC, toR, toC } })
    }
  }
  const sendRematch = () => {
    if (!channelReady) return
    if (selfId === stateRef.current.hostId) {
      const next = restartXiangqiRound(stateRef.current)
      publishState(next)
      scheduleAiTurn(next)
    } else {
      channelRef.current?.send({ type: 'broadcast', event: 'rematch', payload: { round: stateRef.current.round } })
    }
  }
  const leaveRoom = () => {
    if (!selfId || !channelReady) return
    setLeaveConfirmOpen(false)
    if (selfId === stateRef.current.hostId) {
      const next = removeXiangqiPlayer(stateRef.current, selfId)
      if (next) publishState(next)
    } else {
      channelRef.current?.send({ type: 'broadcast', event: 'leave', payload: { userId: selfId } })
    }
  }
  const sendJoin = () => {
    if (!selfId || !channelReady || !channelRef.current || joinStatus === 'joining') return
    setJoinStatus('joining')
    if (selfId === stateRef.current.hostId) {
      const cur = stateRef.current
      if (cur.players.some((pl) => pl.userId === selfId)) { setJoinStatus('idle'); return }
      if (cur.players.length >= 2) { setJoinStatus('retry'); return }
      const color: 1 | 2 = cur.players.some((player) => player.color === 1) ? 2 : 1
      const restarting = cur.status === 'result'
      const round = cur.round + (cur.status === 'result' ? 1 : 0)
      const newPlayer = { userId: selfId as string, displayName, avatarUrl, avatarStyle, avatarSeed, color, score: 0, joinedAt: currentTimestamp() }
      const next: XiangqiState = {
        ...cur,
        board: restarting ? initialBoard() : cur.board,
        turn: restarting ? (round % 2 === 1 ? 1 : 2) : cur.turn,
        winnerId: restarting ? null : cur.winnerId,
        lastMove: restarting ? null : cur.lastMove,
        round,
        players: [...cur.players, newPlayer],
        status: cur.players.length + 1 >= 2 ? 'playing' : 'waiting',
      }
      publishState(next)
      return
    }
    const failJoin = () => {
      if (stateRef.current.players.some((player) => player.userId === selfId)) return
      if (joinTimeoutRef.current !== null) window.clearTimeout(joinTimeoutRef.current)
      joinTimeoutRef.current = null
      setJoinStatus('retry')
    }
    joinTimeoutRef.current = window.setTimeout(failJoin, 10000)
    void channelRef.current.send({ type: 'broadcast', event: 'join', payload: { userId: selfId, displayName, avatarUrl, avatarStyle, avatarSeed } }).then((status: string) => {
      if (status !== 'ok') failJoin()
    }, failJoin)
  }
  const sendAiJoin = () => {
    if (!channelReady || !selfId || !channelRef.current) return
    if (selfId === stateRef.current.hostId) {
      const next = addAiOpponent(stateRef.current)
      if (next) { publishState(next); scheduleAiTurn(next) }
    } else {
      channelRef.current.send({ type: 'broadcast', event: 'ai', payload: {} })
    }
  }

  // selection handling
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(null)
    setLegalTargets(new Set())
  }, [state.lastMove, state.turn, state.status])

  const onCellClick = (r: number, c: number) => {
    if (!isMyTurn) return
    const side = sideOfColor(myColor!)
    const piece = state.board[r][c]
    // if selected and target legal
    if (selected) {
      const key = `${r},${c}`
      if (legalTargets.has(key)) {
        sendMove(selected[0], selected[1], r, c)
        setSelected(null)
        setLegalTargets(new Set())
        return
      }
    }
    // select own piece
    if (piece !== 0 && pieceSide(piece) === side) {
      const moves = legalMoves(state.board, side).filter((m) => m.from[0] === r && m.from[1] === c)
      setSelected([r, c])
      setLegalTargets(new Set(moves.map((m) => `${m.to[0]},${m.to[1]}`)))
      return
    }
    setSelected(null)
    setLegalTargets(new Set())
  }

  // need pieceSide import
  // (imported below via logic? add)
  if (!isSupabaseConfigured()) {
    return <div className="xiangqi-card"><p className="xiangqi-empty">{t('游戏需要联网（Supabase）', 'Games require an online connection')}</p></div>
  }

  const isPlayer = myColor !== null
  const spectators = onlineMembers.filter((member) => !state.players.some((player) => player.userId === member.userId))
  const canJoin = !isPlayer && state.players.length < 2 && (state.status === 'waiting' || state.status === 'result')
  const canJoinAI = isPlayer && state.players.length === 1 && state.status === 'waiting'
  const hasAiOpponent = state.players.some((player) => player.isAI)
  const hasHumanOpponent = state.players.some((player) => !player.isAI && player.userId !== selfId)
  const waitingSolo = state.status === 'waiting' && state.players.length === 1
  const canRestart = isPlayer && (hasAiOpponent || state.status === 'result')
  const canLeave = isPlayer && (hasHumanOpponent || hasAiOpponent || waitingSolo)
  const statusHint = state.status === 'waiting'
    ? state.players.length === 0 ? t('等待玩家加入', 'Waiting for player') : isPlayer ? t('等待玩家', 'Waiting for player') : t('欢迎你加入', "You're welcome to join")
    : state.status === 'playing'
      ? isPlayer ? (isMyTurn ? t('轮到你了', 'Your turn') : t('等待对手', 'Waiting for opponent')) : t('观战中', 'Spectating')
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
    <div className="xiangqi-card">
      <div className="xiangqi-head">
        <div className="xiangqi-heading">
          <span className="xiangqi-title">{t('中国象棋', 'Chinese Chess')}</span>
          <button
            type="button"
            className="xiangqi-style-random"
            onClick={randomizeBoardStyle}
            aria-label={t('随机切换棋盘风格', 'Randomize board style')}
            title={t('随机切换棋盘风格', 'Randomize board style')}
          >
            <PaletteIcon size={16} />
          </button>
          {statusHint && (state.status === 'playing' && !isPlayer ? (
            <span className="xiangqi-spectator-control">
              <button type="button" className="xiangqi-status xiangqi-spectator-trigger" aria-haspopup="dialog" aria-expanded={spectatorsOpen} onClick={() => setSpectatorsOpen((o) => !o)}>
                <span>{statusHint}{spectators.length > 0 ? ` (${spectators.length > 99 ? '99+' : spectators.length})` : ''}</span>
              </button>
              {spectatorsOpen && <OnlineList members={spectators} placement="bottom" className="xiangqi-spectator-pop" title={t('观战玩家', 'Spectators')} emptyText={t('暂无观战玩家', 'No spectators currently')} ownerSelector=".xiangqi-spectator-control" onClose={() => setSpectatorsOpen(false)} />}
            </span>
          ) : <span className="xiangqi-status">{statusHint}</span>)}
        </div>
        <span className="xiangqi-meta">
          {statusHint && <span className="xiangqi-status-dot" aria-hidden="true" />}
          <span>{state.players.length}/2 {t('玩家', 'players')}</span>
        </span>
      </div>

      <div className="xiangqi-players">
        {state.players.map((p) => (
          <div key={p.userId} className="xiangqi-player-slot">
            {p.isAI ? (
              <span className="xiangqi-ai-avatar" aria-label="AI">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v3M9 3h6M7 8h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Z" /><path d="M8.5 13h.01M15.5 13h.01M9 17h6" /></svg>
              </span>
            ) : (
              <AvatarBadge className="xiangqi-player-avatar" size={30} look={{ style: p.avatarStyle || profileLooks[p.userId]?.style || 'thumbs', seed: p.avatarSeed || profileLooks[p.userId]?.seed || p.userId, url: p.avatarUrl ?? profileLooks[p.userId]?.url }} />
            )}
            <div className={`xiangqi-player${p.userId === selfId ? ' is-self' : ''}${state.turn === p.color && state.status === 'playing' ? ' is-turn' : ''}`}>
              <span
                className={`xiangqi-side-indicator ${p.color === 1 ? 'is-red' : 'is-black'}`}
                role="img"
                aria-label={p.color === 1 ? t('红方棋子', 'Red pieces') : t('黑方棋子', 'Black pieces')}
                title={p.color === 1 ? t('红方', 'Red side') : t('黑方', 'Black side')}
              />
              <span className="xiangqi-player-name" title={p.displayName}>{p.displayName}</span>
              <span className="xiangqi-player-score">{p.score}</span>
            </div>
          </div>
        ))}
      </div>

      {state.status === 'result' && <div className="xiangqi-result">{resultText()}</div>}

      <div ref={boardElementRef} className={`xiangqi-board xiangqi-board--${boardStyle}${myColor === 2 ? ' xiangqi-board--flipped' : ''}`} role="grid" aria-label={t('中国象棋棋盘', 'Chinese Chess board')}>
        {boardStyle === 'concave' && (
          <span className="xiangqi-concave-tiles" aria-hidden="true">
            {Array.from({ length: 72 }, (_, index) => (
              <span key={index} className={Math.floor(index / 8) === 4 ? 'is-river' : ''} />
            ))}
          </span>
        )}
        <span className="xiangqi-grid-lines" aria-hidden="true" />
        <span className="xiangqi-frame" aria-hidden="true" />
        <svg className="xiangqi-palace" viewBox="0 0 8 9" preserveAspectRatio="none" aria-hidden="true">
          <line x1="3" y1="0" x2="5" y2="2" />
          <line x1="5" y1="0" x2="3" y2="2" />
          <line x1="3" y1="7" x2="5" y2="9" />
          <line x1="5" y1="7" x2="3" y2="9" />
        </svg>
        <div className="xiangqi-river" aria-hidden="true">
          <span>楚河</span>
          <span>漢界</span>
        </div>
        {captureToast && <div className={`xiangqi-capture-toast${captureToastIsCheck ? ' is-check' : ''}${captureToastIsWinner ? ' is-winner' : ''}`} role="status" aria-live="assertive">{captureToast}</div>}
        {state.board.map((row, r) =>
          row.map((cell, c) => {
            const isLastFrom = state.lastMove?.from[0] === r && state.lastMove.from[1] === c
            const isLastTo = state.lastMove?.to[0] === r && state.lastMove.to[1] === c
            const isSel = selected && selected[0] === r && selected[1] === c
            const isTarget = legalTargets.has(`${r},${c}`)
            const isRedPiece = cell > 0
            return (
              <button
                key={`${r}-${c}`}
                data-cell={`${r}-${c}`}
                type="button"
                className={`xiangqi-cell${isLastFrom ? ' is-last-from' : ''}${isLastTo ? ' is-last-to' : ''}${isSel ? ' is-selected' : ''}${isTarget ? ' is-target' : ''}${(r + c) % 2 === 0 ? ' is-dark' : ''}`}
                onClick={() => onCellClick(r, c)}
                aria-label={`${r + 1},${c + 1}`}
              >
                {cell !== 0 && <span className={`xiangqi-piece ${isRedPiece ? 'is-red' : 'is-black'}`}>{PIECE_GLYPH[cell]}</span>}
                {isTarget && cell === 0 && <span className="xiangqi-dot" />}
              </button>
            )
          }),
        )}
      </div>

      <div className="xiangqi-actions">
        {canJoin && (
          <button type="button" className="btn-accent" disabled={!channelReady || !selfId || joinStatus === 'joining'} aria-busy={joinStatus === 'joining'} onClick={sendJoin}>
            {!channelReady || !selfId ? t('连接游戏中…', 'Connecting…') : joinStatus === 'joining' ? t('正在加入…', 'Joining…') : joinStatus === 'retry' ? t('加入较慢，点击重试', 'Taking longer; tap to retry') : t('加入游戏', 'Join game')}
          </button>
        )}
        {canJoinAI && (
          <button type="button" className="btn-accent" disabled={!channelReady} onClick={sendAiJoin}>{t('与 AI 对战', 'Play vs AI')}</button>
        )}
        {canRestart && (
          <button type="button" className="btn-accent" disabled={!channelReady} onClick={sendRematch}>{t('重新开始', 'Restart')}</button>
        )}
        {canLeave && (
          <button type="button" className="btn-accent" disabled={!channelReady} onClick={() => setLeaveConfirmOpen(true)}>{t('离开房间', 'Leave room')}</button>
        )}
      </div>

      {leaveConfirmOpen && (
        <div className="xiangqi-confirm-backdrop" onClick={() => setLeaveConfirmOpen(false)}>
          <div className="xiangqi-confirm" role="alertdialog" aria-modal="true" aria-labelledby="xiangqi-confirm-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="xiangqi-confirm-title">{t('离开这场对局？', 'Leave this game?')}</h3>
            <p>{t('离开后棋盘会重置，你可以之后重新加入。', 'The board will reset when you leave. You can join again later.')}</p>
            <div className="xiangqi-confirm-actions">
              <button type="button" className="xiangqi-confirm-cancel" onClick={() => setLeaveConfirmOpen(false)}>{t('继续游戏', 'Stay')}</button>
              <button type="button" className="btn-accent" onClick={leaveRoom}>{t('离开房间', 'Leave room')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
