import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '../../lib/supabaseClient'
import { isSupabaseConfigured } from '../../lib/supabaseConfig'
import { useAccount } from '../../lib/useAccount'
import { loadUserProfile } from '../../lib/userProfile'
import { resolveChatIdentity } from '../../lib/identity'
import { t, useLang } from '../../lib/i18n'
import { chooseAiMove } from './ai'
import { loadGomokuState, saveGomokuState } from './cloudState'
import { PaletteIcon } from '../../components/icons'
import './GomokuGame.css'

const BOARD_STYLES = ['classic', 'minimal', 'dark', 'neon', 'ocean', 'sakura', 'forest', 'retro'] as const
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
}

export default function GomokuGame({ instanceId, hostUserId }: Props) {
  useLang()
  const account = useAccount()
  const identity = resolveChatIdentity(account)
  const profile = loadUserProfile()
  const displayName = profile?.nickname ?? identity?.displayName ?? 'Player'
  const avatarUrl = profile?.avatarUrl ?? identity?.avatarUrl ?? null
  const selfId = identity?.userId ?? null

  const [state, setState] = useState<GomokuState>(() => createInitialState(instanceId, hostUserId))
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [boardStyle, setBoardStyle] = useState<BoardStyle>(() => {
    try {
      const saved = window.localStorage.getItem('gomoku-board-style')
      if (saved && (BOARD_STYLES as readonly string[]).includes(saved)) return saved as BoardStyle
    } catch {
      // ignore
    }
    return 'classic'
  })
  const randomizeBoardStyle = useCallback(() => {
    setBoardStyle((prev) => {
      if (BOARD_STYLES.length <= 1) return prev
      let next = prev
      while (next === prev) next = BOARD_STYLES[Math.floor(Math.random() * BOARD_STYLES.length)]
      try {
        window.localStorage.setItem('gomoku-board-style', next)
      } catch {
        // ignore
      }
      return next
    })
  }, [])
  const [readyChannelKey, setReadyChannelKey] = useState('')
  const channelKey = `${instanceId}:${selfId ?? ''}:${displayName}:${avatarUrl ?? ''}`
  const channelReady = readyChannelKey === channelKey
  const channelRef = useRef<ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>['channel']> | null>(null)
  const stateRef = useRef(state)
  const stateLoadedRef = useRef(false)
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve())
  const aiTimerRef = useRef<number | null>(null)
  const departureTimersRef = useRef(new Map<string, number>())
  const selfIdRef = useRef(selfId)
  useEffect(() => {
    stateRef.current = state
  }, [state])
  useEffect(() => {
    selfIdRef.current = selfId
  }, [selfId])

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

  useEffect(() => () => {
    if (aiTimerRef.current !== null) window.clearTimeout(aiTimerRef.current)
    departureTimersRef.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  // Any signed-in client that holds the latest state persists it, so progress
  // survives refreshes regardless of who hosts the room.
  useEffect(() => {
    if (!channelReady || !selfId) return
    persistQueueRef.current = persistQueueRef.current
      .catch(() => undefined)
      .then(() => saveGomokuState(instanceId, state))
  }, [channelReady, instanceId, selfId, state])

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
        stateRef.current = init
        setState(init)
        setReadyChannelKey(channelKey)
        channel?.send({ type: 'broadcast', event: 'state', payload: init })
      }

      channel.on('broadcast', { event: 'state' }, ({ payload }) => {
        if (isGomokuState(payload, instanceId)) {
          stateLoadedRef.current = true
          stateRef.current = payload
          setState(payload)
          setReadyChannelKey(channelKey)
          if (selfIdRef.current === payload.hostId) scheduleAiTurn(payload)
          reconcilePresence()
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
        const p = payload as { userId?: string; displayName?: string; avatarUrl?: string | null }
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
        const restarting = cur.status === 'result' || cur.status === 'waiting'
        const round = cur.round + (cur.status === 'result' ? 1 : 0)
        const basePlayers = cur.players
        const color: 1 | 2 = cur.players.some((pl) => pl.color === 1) ? 2 : 1
        const existingScore = cur.players.find((pl) => pl.userId === p.userId)?.score ?? 0
        const newPlayer = {
          userId: p.userId,
          displayName: p.displayName ?? 'Player',
          avatarUrl: p.avatarUrl ?? null,
          color,
          score: existingScore,
          joinedAt: Date.now(),
        }
        const nextPlayers = [...basePlayers, newPlayer]
        const next: GomokuState = {
          ...cur,
          board: restarting ? emptyBoard() : cur.board,
          turn: round % 2 === 1 ? 1 : 2,
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
        const timer = departureTimersRef.current.get(p.userId)
        if (timer !== undefined) window.clearTimeout(timer)
        departureTimersRef.current.delete(p.userId)
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
          for (const player of cur.players) {
            if (player.isAI) continue
            const pending = departureTimersRef.current.get(player.userId)
            if (userIds.includes(player.userId)) {
              if (pending !== undefined) window.clearTimeout(pending)
              departureTimersRef.current.delete(player.userId)
              continue
            }
            if (pending !== undefined) continue
            const timer = window.setTimeout(() => {
              departureTimersRef.current.delete(player.userId)
              const current = stateRef.current
              const stillPresent = Object.keys(channel?.presenceState() ?? {}).includes(player.userId)
              if (selfIdRef.current !== current.hostId || stillPresent) return
              const next = removeGomokuPlayer(current, player.userId)
              if (next) publishState(next)
            }, 2000)
            departureTimersRef.current.set(player.userId, timer)
          }
        }
      }
      channel.on('presence', { event: 'sync' }, reconcilePresence)

      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel?.track({ userId: selfId, displayName, avatarUrl })
          const saved = await loadGomokuState(instanceId)
          if (cancelled) return
          if (saved) {
            cloudStateChecked = true
            stateLoadedRef.current = true
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
        } else {
          setReadyChannelKey('')
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
  }, [instanceId, hostUserId, selfId, displayName, avatarUrl, channelKey, publishState, scheduleAiTurn])

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
    if (!selfId || !channelReady || !channelRef.current) return
    if (selfId === stateRef.current.hostId) {
      // The host does not receive its own broadcast, so apply locally.
      const cur = stateRef.current
      if (cur.players.some((pl) => pl.userId === selfId)) return
      if (cur.players.length >= 2) return
      const color: 1 | 2 = cur.players.some((player) => player.color === 1) ? 2 : 1
      const restarting = cur.status === 'result' || cur.status === 'waiting'
      const round = cur.round + (cur.status === 'result' ? 1 : 0)
      const newPlayer = {
        userId: selfId as string,
        displayName,
        avatarUrl,
        color,
        score: 0,
        joinedAt: Date.now(),
      }
      const next: GomokuState = {
        ...cur,
        board: restarting ? emptyBoard() : cur.board,
        turn: round % 2 === 1 ? 1 : 2,
        winnerId: restarting ? null : cur.winnerId,
        winningLine: restarting ? null : cur.winningLine,
        lastMove: restarting ? null : cur.lastMove,
        round,
        players: [...cur.players, newPlayer],
        status: cur.players.length + 1 >= 2 ? 'playing' : 'waiting',
      }
      publishState(next)
      return
    }
    channelRef.current.send({ type: 'broadcast', event: 'join', payload: { userId: selfId, displayName, avatarUrl } })
  }

  const sendAiJoin = () => {
    if (!channelReady || !selfId || !channelRef.current) return
    if (selfId === stateRef.current.hostId) {
      const next = addAiOpponent(stateRef.current)
      if (next) {
        publishState(next)
        scheduleAiTurn(next)
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
          {statusHint && <span className="gomoku-status">{statusHint}</span>}
        </div>
        <span className="gomoku-meta">
          {statusHint && <span className="gomoku-status-dot" aria-hidden="true" />}
          <span>{state.players.length}/2 {t('玩家', 'players')}</span>
        </span>
      </div>

      <div className="gomoku-players">
        {state.players.map((p) => (
          <div key={p.userId} className={`gomoku-player${p.userId === selfId ? ' is-self' : ''}${state.turn === p.color && state.status === 'playing' ? ' is-turn' : ''}`}>
            <span className="gomoku-stone" data-color={p.color} />
            <span className="gomoku-player-name">{p.displayName}</span>
            <span className="gomoku-player-score">{p.score}</span>
          </div>
        ))}
      </div>

      {state.status === 'result' && (
        <div className="gomoku-result">{resultText()}</div>
      )}

      <div className={`gomoku-board gomoku-board--${boardStyle}`} role="grid" aria-label={t('五子棋棋盘', 'Gomoku board')}>
        <span className="gomoku-grid-lines" aria-hidden="true" />
        <span className="gomoku-frame" aria-hidden="true" />
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
          <button type="button" className="btn-accent" disabled={!channelReady || !selfId} onClick={sendJoin}>
            {channelReady && selfId ? t('加入游戏', 'Join game') : t('连接游戏中…', 'Connecting…')}
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
