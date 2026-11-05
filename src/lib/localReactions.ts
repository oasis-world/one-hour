/**
 * Local reactions — IndexedDB persistence for private/local messages
 * (companion chats + MUD card messages). Mirrors the shape of
 * chatReactions.ts but lives entirely on this device.
 */
import {
  LOCAL_REACTIONS_STORE,
  idbClear,
  idbDelete,
  idbGetAll,
  idbPut,
} from './idb'
import type { RoomReactionRecord } from './chatReactions'

export interface LocalReactionRow extends RoomReactionRecord {
  id: string
}

export function localReactionId(messageId: string, userId: string, emoji: string): string {
  return `${messageId}:${userId}:${emoji}`
}

function toRow(r: RoomReactionRecord): LocalReactionRow {
  return { ...r, id: localReactionId(r.messageId, r.userId, r.emoji) }
}

export async function loadLocalReactions(): Promise<RoomReactionRecord[]> {
  const rows = await idbGetAll<LocalReactionRow>(LOCAL_REACTIONS_STORE)
  if (!rows) return []
  return rows
    .filter((r) => r && typeof r.messageId === 'string' && typeof r.userId === 'string' && typeof r.emoji === 'string')
    .map((r) => ({ messageId: r.messageId, userId: r.userId, emoji: r.emoji }))
}

export async function saveLocalReaction(record: RoomReactionRecord): Promise<void> {
  await idbPut(LOCAL_REACTIONS_STORE, toRow(record))
}

export async function removeLocalReaction(messageId: string, userId: string, emoji: string): Promise<void> {
  await idbDelete(LOCAL_REACTIONS_STORE, localReactionId(messageId, userId, emoji))
}

export async function removeLocalReactionsForMessage(messageId: string): Promise<void> {
  const rows = await idbGetAll<LocalReactionRow>(LOCAL_REACTIONS_STORE)
  if (!rows) return
  const doomed = rows.filter((r) => r.messageId === messageId)
  await Promise.all(doomed.map((r) => idbDelete(LOCAL_REACTIONS_STORE, r.id)))
}

export async function pruneLocalReactions(validMessageIds: Set<string>): Promise<void> {
  const rows = await idbGetAll<LocalReactionRow>(LOCAL_REACTIONS_STORE)
  if (!rows) return
  const stale = rows.filter((r) => !validMessageIds.has(r.messageId))
  if (stale.length === 0) return
  await Promise.all(stale.map((r) => idbDelete(LOCAL_REACTIONS_STORE, r.id)))
}

export async function clearLocalReactions(): Promise<void> {
  await idbClear(LOCAL_REACTIONS_STORE)
}
