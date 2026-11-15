import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '../../lib/supabaseClient'
import { isSupabaseConfigured } from '../../lib/supabaseConfig'
import { useAccount } from '../../lib/useAccount'
import { resolveChatIdentity } from '../../lib/identity'
import { loadUserProfile } from '../../lib/userProfile'
import { getGamePresenceKey, getGamePresenceUsers, installGameWakeRecovery, isGameHostAuthority, removeStaleGameChannel, sendGameBroadcast } from '../realtime'
import { createBlackjackState, type BlackjackState } from './model'
import { isBlackjackState } from './validation'
import { loadBlackjackState, saveBlackjackState } from './cloudState'
import { type Command, reduceBlackjackCommand } from './roomCommands'

export function useBlackjackRoom(instanceId: string, hostUserId: string) {
  const account = useAccount()
  const identity = resolveChatIdentity(account)
  const profile = loadUserProfile()
  const selfId = identity?.userId ?? null
  const displayName = identity?.displayName ?? profile?.nickname ?? 'Player'
  const avatarUrl = identity?.avatarUrl ?? null
  const avatarStyle = identity?.avatar?.style
  const avatarSeed = identity?.avatar?.seed
  const [state, setState] = useState(() => createBlackjackState(instanceId, isSupabaseConfigured() ? hostUserId : selfId ?? hostUserId))
  const [ready, setReady] = useState(() => !isSupabaseConfigured())
  const [attempt, setAttempt] = useState(0)
  const stateRef = useRef(state)
  const channelRef = useRef<ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>['channel']> | null>(null)
  const loadedRef = useRef(!isSupabaseConfigured())

  useEffect(() => { stateRef.current = state }, [state])

  const publish = useCallback((next: BlackjackState) => {
    stateRef.current = next
    setState(next)
    sendGameBroadcast(channelRef.current, 'state', next)
    if (isSupabaseConfigured()) void saveBlackjackState(next, () => {
      const channel = channelRef.current
      return Boolean(channel && stateRef.current === next && isGameHostAuthority(channel, next.leaderId))
    })
  }, [])

  const reduce = useCallback((command: Command) => {
    const current = stateRef.current
    const next = reduceBlackjackCommand(current, command)
    if (next !== current) publish(next)
  }, [publish])

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return
    }
    if (!selfId) return
    let cancelled = false
    let reconnect: number | null = null
    let wakeCleanup: (() => void) | null = null
    let channel: ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>['channel']> | null = null
    let client: Awaited<ReturnType<typeof getSupabaseClient>> | null = null
    const presenceKey = getGamePresenceKey(selfId)
    const topic = `game:blackjack:${instanceId}`
    const retry = () => {
      if (cancelled || reconnect !== null) return
      setReady(false)
      reconnect = window.setTimeout(() => {
        reconnect = null
        if (!cancelled) setAttempt((value) => value + 1)
      }, 1600)
    }
    void (async () => {
      client = await getSupabaseClient().catch(() => null)
      if (!client || cancelled) { retry(); return }
      const savedState = await loadBlackjackState(instanceId)
      if (cancelled) return
      if (savedState) {
        stateRef.current = savedState
        setState(savedState)
        loadedRef.current = true
      }
      await removeStaleGameChannel(client, topic)
      if (cancelled) return
      channel = client.channel(topic, { config: { presence: { key: presenceKey } } })
      channelRef.current = channel
      const reconcile = () => {
        if (!channel) return
        const users = getGamePresenceUsers(channel)
        if (!users.length) return
        if (loadedRef.current) {
          const current = stateRef.current
          if (users.includes(current.leaderId)) return
          const nextLeader = users.includes(hostUserId) ? hostUserId : users[0]
          if (nextLeader === selfId && isGameHostAuthority(channel, selfId)) publish({ ...current, leaderId: selfId })
          return
        }
        const leader = users.includes(hostUserId) ? hostUserId : users[0]
        if (leader === selfId && isGameHostAuthority(channel, selfId)) {
          loadedRef.current = true
          publish(createBlackjackState(instanceId, selfId))
        }
      }
      channel.on('broadcast', { event: 'state' }, ({ payload }) => {
        if (cancelled || !isBlackjackState(payload, instanceId)) return
        loadedRef.current = true
        stateRef.current = payload
        setState(payload)
      })
      channel.on('broadcast', { event: 'state-request' }, () => {
        if (loadedRef.current && stateRef.current.leaderId === selfId && channel) sendGameBroadcast(channel, 'state', stateRef.current)
      })
      channel.on('broadcast', { event: 'command' }, ({ payload }) => {
        if (!channel || stateRef.current.leaderId !== selfId || !isGameHostAuthority(channel, selfId)) return
        if (!payload || typeof payload !== 'object' || !('type' in payload)) return
        reduce(payload as Command)
      })
      channel.on('presence', { event: 'sync' }, reconcile)
      wakeCleanup = installGameWakeRecovery({
        getChannel: () => channel,
        getClient: () => client,
        shouldCheck: () => !cancelled,
        onStale: retry,
      })
      await channel.subscribe(async (status) => {
        if (cancelled) return
        if (status === 'SUBSCRIBED') {
          try {
            await channel!.track({ userId: selfId, displayName, avatarUrl })
            if (cancelled) return
            setReady(true)
            sendGameBroadcast(channel, 'state-request', {})
            reconcile()
          } catch { retry() }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') retry()
      })
    })()
    return () => {
      cancelled = true
      wakeCleanup?.()
      if (reconnect !== null) window.clearTimeout(reconnect)
      const current = channel
      channelRef.current = null
      if (current) void current.unsubscribe(1000).finally(() => current.teardown())
    }
  }, [instanceId, hostUserId, selfId, displayName, avatarUrl, attempt, publish, reduce])

  const dispatch = useCallback((command: Command) => {
    if (!ready) return
    if (!isSupabaseConfigured()) { reduce(command); return }
    const channel = channelRef.current
    if (stateRef.current.leaderId === selfId && channel && isGameHostAuthority(channel, selfId ?? '')) {
      reduce(command)
      return
    }
    sendGameBroadcast(channel, 'command', command)
  }, [ready, reduce, selfId])

  const join = useCallback((bet: number) => {
    if (!selfId) return
    dispatch({ type: 'join', player: { userId: selfId, name: displayName, avatarUrl, avatarStyle, avatarSeed, bet } })
  }, [dispatch, selfId, displayName, avatarUrl, avatarStyle, avatarSeed])

  const setDealer = useCallback((dealerId: string | 'ai') => {
    dispatch({ type: 'dealer', dealerId, name: displayName, avatarUrl })
  }, [dispatch, displayName, avatarUrl])
  const quickPlay = useCallback((bet: number) => {
    if (selfId) dispatch({ type: 'quick-play', player: { userId: selfId, name: displayName, avatarUrl, avatarStyle, avatarSeed, bet } })
  }, [dispatch, selfId, displayName, avatarUrl, avatarStyle, avatarSeed])
  const setBet = useCallback((bet: number) => {
    if (selfId) dispatch({ type: 'set-bet', userId: selfId, bet })
  }, [dispatch, selfId])
  const act = useCallback((action: 'hit' | 'stand' | 'double') => {
    if (selfId) dispatch({ type: 'action', userId: selfId, action })
  }, [dispatch, selfId])
  const start = useCallback(() => dispatch({ type: 'start' }), [dispatch])
  const finishDealer = useCallback(() => {
    if (selfId) dispatch({ type: 'finish-dealer', userId: selfId })
  }, [dispatch, selfId])
  const finishAi = useCallback(() => dispatch({ type: 'finish-ai' }), [dispatch])
  const rematch = useCallback(() => dispatch({ type: 'rematch' }), [dispatch])
  const leave = useCallback(() => {
    if (selfId) dispatch({ type: 'leave', userId: selfId })
  }, [dispatch, selfId])
  const isOwnTabAuthority = useCallback(() => !isSupabaseConfigured()
    || Boolean(selfId && channelRef.current && isGameHostAuthority(channelRef.current, selfId)), [selfId])

  return { state, selfId, displayName, ready, join, setDealer, quickPlay, setBet, act, start, finishDealer, finishAi, rematch, leave, isOwnTabAuthority }
}
