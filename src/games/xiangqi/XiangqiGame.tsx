import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '../../lib/supabaseClient'
import { isSupabaseConfigured } from '../../lib/supabaseConfig'
import { useAccount } from '../../lib/useAccount'
import { fetchCloudProfile } from '../../lib/profileCloud'
import { loadUserProfile } from '../../lib/userProfile'
import { resolveChatIdentity } from '../../lib/identity'
import { t, useLang } from '../../lib/i18n'
import AvatarBadge from '../../components/AvatarBadge'
import OnlineList from '../../components/OnlineList'
import type { PresenceMember } from '../../lib/chatTypes'
import { setPopoverOpen } from '../../lib/popoverGuard'
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
  pieceSide,
  removeXiangqiPlayer,
  restartXiangqiRound,
  sideOfColor,
  tryMove,
  type XiangqiState,
} from './logic'

interface Props {
  instanceId: string
  hostUserId: string
  onlineMembers?: PresenceMember[]
}

const BOARD_STYLES = ['wood', 'classic', 'concave'] as const
type BoardStyle = (typeof BOARD_STYLES)[number]

const PIECE_GLYPH: Record<number, string> = {
  1: '帅', 2: '仕', 3: '相', 4: '马', 5: '车', 6: '炮', 7: '兵',
  [-1]: '将', [-2]: '士', [-3]: '象', [-4]: '马', [-5]: '车', [-6]: '炮', [-7]: '卒',
}

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
  const channelKey = `${instanceId}:${selfId ?? ''}:${displayName}:${avatarUrl ?? ''}:${avatarStyle ?? ''}:${avatarSeed ?? ''}`
  const channelReady = readyKey === channelKey
  const channelRef = useRef<ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>['channel']> | null>(null)
  const stateRef = useRef(state)
  const stateLoadedRef = useRef(false)
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve())
  const aiTimerRef = useRef<number | null>(null)
  const joinTimeoutRef = useRef<number | null>(null)
  const selfIdRef = useRef(selfId)
  const profileLookRequestsRef = useRef(new Set<string>())
  useEffect(() => { stateRef.current = state }, [state])
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

  const scheduleAiTurn = useCallback((next: XiangqiState) => {
    const ai = next.players.find((player) => player.isAI && player.color === next.turn)
    if (!ai || next.status !== 'playing') return
    if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current)
    aiTimerRef.current = window.setTimeout(() => {
      const current = stateRef.current
      if (current.status !== 'playing') return
      const aiP = current.players.find((player) => player.isAI && player.color === current.turn)
      if (!aiP || current.turn !== aiP.color) return
      const move = chooseAiMove(current.board, aiP.color)
      if (!move) return
      const afterAi = tryMove(current, aiP.userId, move.from[0], move.from[1], move.to[0], move.to[1])
      if (afterAi) publishState(afterAi)
    }, 400)
  }, [publishState])

  useEffect(() => () => {
    if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current)
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

  const myColor = selfId ? colorOfPlayer(state, selfId) : null
  const isMyTurn = myColor !== null && state.turn === myColor && state.status === 'playing'

  useEffect(() => {
    if (!isSupabaseConfigured() || !selfId) return
    let cancelled = false
    let cloudStateChecked = false
    let channel: ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>['channel']> | null = null

    void (async () => {
      const client = await getSupabaseClient()
      if (cancelled) return
      channel = client.channel(`game:xiangqi:${instanceId}`, { config: { presence: { key: selfId } } })
      channelRef.current = channel

      const initializeIfNeeded = () => {
        if (!cloudStateChecked || stateLoadedRef.current || cancelled) return
        const onlineUsers = Object.keys(channel?.presenceState() ?? {}).sort()
        const expectedHost = onlineUsers.includes(hostUserId) ? hostUserId : (onlineUsers[0] ?? (selfId === hostUserId ? selfId : null))
        if (expectedHost !== selfId) return
        const init = createInitialState(instanceId, selfId)
        stateLoadedRef.current = true
        stateRef.current = init
        setState(init)
        setReadyKey(channelKey)
        channel?.send({ type: 'broadcast', event: 'state', payload: init })
      }

      channel.on('broadcast', { event: 'state' }, ({ payload }: { payload: unknown }) => {
        if (isXiangqiState(payload, instanceId)) {
          stateLoadedRef.current = true
          stateRef.current = payload
          setState(payload)
          setReadyKey(channelKey)
          if (selfIdRef.current === payload.hostId) scheduleAiTurn(payload)
          reconcilePresence()
        }
      })
      channel.on('broadcast', { event: 'move' }, ({ payload }: { payload: unknown }) => {
        if (selfIdRef.current !== stateRef.current.hostId) return
        const p = payload as { userId?: string; fromR?: number; fromC?: number; toR?: number; toC?: number }
        if (!p?.userId || typeof p.fromR !== 'number') return
        const next = tryMove(stateRef.current, p.userId, p.fromR, p.fromC!, p.toR!, p.toC!)
        if (!next) return
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
          turn: restarting ? 1 : cur.turn,
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

      await channel.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel?.track({ userId: selfId, displayName, avatarUrl, avatarStyle, avatarSeed })
          const loaded = await loadXiangqiState(instanceId)
          if (cancelled) return
          if (!loaded.ok) return
          const saved = loaded.state
          if (saved) {
            cloudStateChecked = true
            stateLoadedRef.current = true
            stateRef.current = saved
            setState(saved)
            if (selfId === saved.hostId) {
              channel?.send({ type: 'broadcast', event: 'state', payload: saved })
              scheduleAiTurn(saved)
            }
            setReadyKey(channelKey)
          } else if (stateLoadedRef.current) {
            if (selfId === stateRef.current.hostId) channel?.send({ type: 'broadcast', event: 'state', payload: stateRef.current })
            setReadyKey(channelKey)
          } else {
            cloudStateChecked = true
          }
          reconcilePresence()
        } else {
          setReadyKey('')
        }
      })
    })()

    return () => {
      cancelled = true
      stateLoadedRef.current = false
      if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current)
      if (channel) void channel.unsubscribe()
      channelRef.current = null
    }
  }, [instanceId, hostUserId, selfId, displayName, avatarUrl, avatarStyle, avatarSeed, channelKey, publishState, scheduleAiTurn])

  const sendMove = (fromR: number, fromC: number, toR: number, toC: number) => {
    if (!selfId) return
    if (selfId === stateRef.current.hostId) {
      const next = tryMove(stateRef.current, selfId, fromR, fromC, toR, toC)
      if (next) { publishState(next); scheduleAiTurn(next) }
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
      const newPlayer = { userId: selfId as string, displayName, avatarUrl, avatarStyle, avatarSeed, color, score: 0, joinedAt: Date.now() }
      const next: XiangqiState = {
        ...cur,
        board: restarting ? initialBoard() : cur.board,
        turn: restarting ? 1 : cur.turn,
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
              <span className="xiangqi-player-name" title={p.displayName}>{p.displayName}</span>
              <span className="xiangqi-player-score">{p.score}</span>
            </div>
          </div>
        ))}
      </div>

      {state.status === 'result' && <div className="xiangqi-result">{resultText()}</div>}

      <div className={`xiangqi-board xiangqi-board--${boardStyle}`} role="grid" aria-label={t('中国象棋棋盘', 'Chinese Chess board')}>
        {boardStyle === 'concave' && (
          <span className="xiangqi-concave-tiles" aria-hidden="true">
            {Array.from({ length: 72 }, (_, index) => (
              <span key={index} className={Math.floor(index / 8) === 4 ? 'is-river' : ''} />
            ))}
          </span>
        )}
        <span className="xiangqi-grid-lines" aria-hidden="true" />
        <span className="xiangqi-frame" aria-hidden="true" />
        {boardStyle !== 'concave' && (
          <svg className="xiangqi-palace" viewBox="0 0 8 9" preserveAspectRatio="none" aria-hidden="true">
          <line x1="3" y1="0" x2="5" y2="2" />
          <line x1="5" y1="0" x2="3" y2="2" />
          <line x1="3" y1="7" x2="5" y2="9" />
          <line x1="5" y1="7" x2="3" y2="9" />
        </svg>
        )}
        <div className="xiangqi-river" aria-hidden="true">
          <span>楚河</span>
          <span>漢界</span>
        </div>
        {state.board.map((row, r) =>
          row.map((cell, c) => {
            const isLast = state.lastMove && ([state.lastMove.from[0], state.lastMove.from[1]].join(',') === `${r},${c}` || [state.lastMove.to[0], state.lastMove.to[1]].join(',') === `${r},${c}`)
            const isSel = selected && selected[0] === r && selected[1] === c
            const isTarget = legalTargets.has(`${r},${c}`)
            const isRedPiece = cell > 0
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                className={`xiangqi-cell${isLast ? ' is-last' : ''}${isSel ? ' is-selected' : ''}${isTarget ? ' is-target' : ''}${(r + c) % 2 === 0 ? ' is-dark' : ''}`}
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
