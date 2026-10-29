import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { enterChat, type ChatApi } from '../lib/chatSync'
import type { ChatEntry, ChatStatus, MessageReply, PresenceMember } from '../lib/chatTypes'
import { resolveChatIdentity, type ChatIdentity } from '../lib/identity'
import { useAccount } from '../lib/useAccount'
import {
  applyRoomReactionChange,
  summarizeRoomReactions,
  type RoomReactionChange,
  type RoomReactionRecord,
} from '../lib/chatReactions'

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
  const [reactionRows, setReactionRows] = useState<RoomReactionRecord[]>([])
  const [incomingMessageSequence, setIncomingMessageSequence] = useState(0)
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
      onRemoved: (id) => {
        setEntries((list) => list.filter((e) => e.id !== id))
        setReactionRows((rows) => rows.filter((reaction) => reaction.messageId !== id))
      },
      onPresence: setPresence,
      onStatus: setStatus,
      onIncomingMessage: () => setIncomingMessageSequence((sequence) => sequence + 1),
      onReactionSnapshot: setReactionRows,
      onReaction: (change: RoomReactionChange) =>
        setReactionRows((rows) => applyRoomReactionChange(rows, change)),
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
  const profileDetails = `${identity?.role ?? ''}:${identity?.profileExpiresAt ?? ''}`
  const avatarKey = `${identity?.avatar ? `${identity.avatar.style}:${identity.avatar.seed}` : ''}|${avatarUrl ?? ''}`
  useEffect(() => {
    if (!identity || apiRef.current == null) return
    apiRef.current.updateIdentity(identity)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, displayName, avatarKey, avatarUrl, profileDetails])

  const send = useCallback((text: string, imageBlob?: Blob, replyTo?: MessageReply | null) => {
    apiRef.current?.send(text, imageBlob, replyTo)
  }, [])
  const retry = useCallback(() => apiRef.current?.retry(), [])
  const remove = useCallback((id: string) => apiRef.current?.remove(id), [])
  const edit = useCallback((id: string, content: string) => apiRef.current?.edit(id, content), [])
  const toggleReaction = useCallback((messageId: string, emoji: string) => {
    const reactionUserId = identity?.userId
    if (!reactionUserId) return
    const active = !reactionRows.some(
      (reaction) =>
        reaction.messageId === messageId &&
        reaction.userId === reactionUserId &&
        reaction.emoji === emoji,
    )
    const change: RoomReactionChange = {
      messageId,
      userId: reactionUserId,
      emoji,
      active,
    }
    setReactionRows((rows) => applyRoomReactionChange(rows, change))
    void (apiRef.current?.toggleReaction(messageId, emoji, active) ?? Promise.resolve(false))
      .then((ok) => {
        if (!ok) {
          setReactionRows((rows) => applyRoomReactionChange(rows, { ...change, active: !active }))
        }
      })
      .catch(() => {
        setReactionRows((rows) => applyRoomReactionChange(rows, { ...change, active: !active }))
      })
  }, [identity?.userId, reactionRows])
  const loadOlder = useCallback(() => {
    return (
      apiRef.current?.loadOlder() ?? Promise.resolve({ loaded: 0, hasMore: false })
    )
  }, [])
  const expireUserMessages = useCallback((id: string) => apiRef.current?.expireUserMessages(id), [])

  const active = enabled && identity !== null
  const reactions = useMemo(
    () => summarizeRoomReactions(reactionRows, identity?.userId ?? null),
    [identity?.userId, reactionRows],
  )
  return {
    entries: active ? entries : [],
    presence: active ? presence : [],
    status: (active ? status : 'connecting') as ChatStatus,
    send,
    retry,
    remove,
    edit,
    reactions,
    toggleReaction,
    incomingMessageSequence,
    loadOlder,
    expireUserMessages,
    identity,
  }
}
