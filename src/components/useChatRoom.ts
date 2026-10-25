import { useCallback, useEffect, useRef, useState } from 'react'
import { enterChat, type ChatApi } from '../lib/chatSync'
import type { ChatEntry, ChatStatus, PresenceMember } from '../lib/chatTypes'
import { resolveChatIdentity, type ChatIdentity } from '../lib/identity'
import { useAccount } from '../lib/useAccount'

/**
 * React binding for the global chat room (oasis-game pattern). Joins on
 * mount, leaves on unmount, re-tracks identity in place when the display
 * fields change. Without an identity the room stays in view-only guest
 * mode until the anonymous sign-in lands.
 */
export function useChatRoom(enabled: boolean) {
  const account = useAccount()

  const identity: ChatIdentity | null = enabled
    ? resolveChatIdentity(account)
    : null

  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [presence, setPresence] = useState<PresenceMember[]>([])
  const [status, setStatus] = useState<ChatStatus>('connecting')
  const apiRef = useRef<ChatApi | null>(null)

  // The channel is tied to the user id alone; identity niceties re-track
  // in place so a flaky network never leaves an orphan presence entry.
  const userId = identity?.userId
  useEffect(() => {
    if (!identity) return
    const api = enterChat(identity, {
      onSnapshot: setEntries,
      onEntry: (entry) =>
        setEntries((list) => {
          const index = list.findIndex((e) => e.id === entry.id)
          if (index === -1) return [...list, entry].slice(-400)
          const next = list.slice()
          next[index] = entry
          return next
        }),
      onRemoved: (id) => setEntries((list) => list.filter((e) => e.id !== id)),
      onPresence: setPresence,
      onStatus: setStatus,
    })
    apiRef.current = api
    return () => {
      api.leave()
      apiRef.current = null
    }
    // identity is rebuilt per render; the user id alone owns the channel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const displayName = identity?.displayName
  const avatarUrl = identity?.avatarUrl ?? null
  const avatarKey = `${identity?.avatar ? `${identity.avatar.style}:${identity.avatar.seed}` : ''}|${avatarUrl ?? ''}`
  useEffect(() => {
    if (!identity || apiRef.current == null) return
    apiRef.current.updateIdentity(identity)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, displayName, avatarKey, avatarUrl])

  const send = useCallback((text: string, imageBlob?: Blob) => {
    apiRef.current?.send(text, imageBlob)
  }, [])
  const retry = useCallback(() => apiRef.current?.retry(), [])
  const remove = useCallback((id: string) => apiRef.current?.remove(id), [])
  const loadOlder = useCallback(() => {
    return (
      apiRef.current?.loadOlder() ?? Promise.resolve({ loaded: 0, hasMore: false })
    )
  }, [])

  const active = enabled && identity !== null
  return {
    entries: active ? entries : [],
    presence: active ? presence : [],
    status: (active ? status : 'connecting') as ChatStatus,
    send,
    retry,
    remove,
    loadOlder,
    identity,
  }
}
