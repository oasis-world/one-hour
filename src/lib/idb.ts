/**
 * Minimal IndexedDB wrapper (no dependency). Two stores:
 *  - messages: confirmed chat rows (the local read path / 铁律 1)
 *  - outbox:   pending sends incl. the image Blob, retried with backoff
 * Everything is best-effort: an unavailable IndexedDB (private mode,
 * quota) degrades to memory-only — the chat keeps working.
 */

const DB_NAME = 'one-hour-chat'
const DB_VERSION = 1

export const MESSAGES_STORE = 'messages'
export const OUTBOX_STORE = 'outbox'

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      if (!globalThis.indexedDB) return resolve(null)
      const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
          db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null)
        try {
          const transaction = db.transaction(store, mode)
          const request = run(transaction.objectStore(store))
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => resolve(null)
          transaction.onabort = () => resolve(null)
        } catch {
          resolve(null)
        }
      }),
  )
}

export function idbGetAll<T>(store: string): Promise<T[] | null> {
  return tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)
}

export function idbPut(store: string, value: unknown): Promise<unknown> {
  return tx(store, 'readwrite', (s) => s.put(value))
}

export function idbDelete(store: string, key: string): Promise<unknown> {
  return tx(store, 'readwrite', (s) => s.delete(key))
}

export function idbClear(store: string): Promise<unknown> {
  return tx(store, 'readwrite', (s) => s.clear())
}
