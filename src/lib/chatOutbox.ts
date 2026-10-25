import { idbDelete, idbGetAll, idbPut, OUTBOX_STORE } from './idb'

/**
 * Durable outbox for chat sends (oasis-game pattern, moved to IndexedDB so
 * image Blobs survive too): a send is queued before any network attempt, so
 * an offline or flaky send never loses the player's words or photos — the
 * sync facade retries from this queue with backoff.
 */

export interface ChatOutboxItem {
  /** Client-generated message id — also the id of the optimistic entry. */
  id: string
  content: string
  displayName: string
  /** epoch ms */
  at: number
  /** Failed send attempts so far (the current try not included). */
  attempts: number
  /** Downscaled image waiting for its storage upload. */
  imageBlob?: Blob
}

export const CHAT_OUTBOX_MAX_ATTEMPTS = 5
const QUEUE_CAP = 30

export async function readOutbox(): Promise<ChatOutboxItem[]> {
  const rows = await idbGetAll<ChatOutboxItem>(OUTBOX_STORE)
  if (!rows) return []
  return rows.sort((a, b) => a.at - b.at)
}

export async function enqueueOutbox(item: ChatOutboxItem): Promise<void> {
  const queue = (await readOutbox()).filter((entry) => entry.id !== item.id)
  queue.push(item)
  await writeOutbox(queue.slice(-QUEUE_CAP))
}

export async function removeFromOutbox(id: string): Promise<void> {
  await idbDelete(OUTBOX_STORE, id)
}

/** Record one failed attempt; returns true when retries are exhausted. */
export async function markOutboxFailed(id: string): Promise<boolean> {
  const queue = await readOutbox()
  const item = queue.find((entry) => entry.id === id)
  if (!item) return true
  item.attempts += 1
  await writeOutbox(queue)
  return item.attempts >= CHAT_OUTBOX_MAX_ATTEMPTS
}

/** Permanently-failing item (server refused): burn the retry budget. */
export async function exhaustOutboxItem(id: string): Promise<void> {
  const queue = await readOutbox()
  const item = queue.find((entry) => entry.id === id)
  if (!item) return
  item.attempts = CHAT_OUTBOX_MAX_ATTEMPTS
  await writeOutbox(queue)
}

async function writeOutbox(queue: ChatOutboxItem[]): Promise<void> {
  await Promise.all(queue.map((item) => idbPut(OUTBOX_STORE, item)))
}
