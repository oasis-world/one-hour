import { idbDelete, idbGetAll, idbPut, MESSAGES_STORE } from './idb'
import type { ChatEntry } from './chatTypes'

/**
 * Local cache of confirmed chat messages in IndexedDB: opening the app
 * renders from here instantly, the network reconciles afterwards, and
 * scroll-to-top reads older pages from here before ever hitting the server.
 */

const CACHE_LIMIT = 400

/** All cached confirmed entries, oldest → newest. Empty when IDB is down. */
export async function loadChatCache(): Promise<ChatEntry[]> {
  const rows = await idbGetAll<ChatEntry>(MESSAGES_STORE)
  if (!rows) return []
  return rows
    .filter((row) => row && typeof row.id === 'string' && !row.state)
    .sort(compareEntries)
}

/** Persist confirmed entries (pending/failed ones are outbox territory). */
export async function saveChatCache(entries: ChatEntry[]): Promise<void> {
  const confirmed = entries.filter((entry) => !entry.state)
  if (confirmed.length === 0) return
  await Promise.all(confirmed.slice(-CACHE_LIMIT).map((entry) => idbPut(MESSAGES_STORE, entry)))
}

export async function removeChatCacheEntry(id: string): Promise<void> {
  await idbDelete(MESSAGES_STORE, id)
}

/** Cached entries strictly older than the cursor (for loadOlder's local path). */
export async function loadChatCacheBefore(
  before: { createdAt: number; id: string },
  limit = 60,
): Promise<ChatEntry[]> {
  const all = await loadChatCache()
  return all
    .filter((entry) => {
      const time = entry.serverCreatedAt
        ? new Date(entry.serverCreatedAt).getTime()
        : entry.at
      return time < before.createdAt || (time === before.createdAt && entry.id < before.id)
    })
    .sort(compareEntries)
    .slice(-limit)
}

export function compareEntries(a: ChatEntry, b: ChatEntry): number {
  return a.at - b.at || a.id.localeCompare(b.id)
}
