import {
  fetchChatPage,
  fetchExistingMessageIds,
  joinChatRoom,
  purgeExpiredRemote,
  type ChatCursor,
  type RoomHandle,
} from './chatRemote'
import {
  compareEntries,
  loadChatCache,
  loadChatCacheBefore,
  pruneChatCache,
  removeChatCacheEntry,
  saveChatCache,
} from './chatCache'
import {
  CHAT_OUTBOX_MAX_ATTEMPTS,
  enqueueOutbox,
  exhaustOutboxItem,
  markOutboxFailed,
  readOutbox,
  removeFromOutbox,
  updateOutboxContent,
  type ChatOutboxItem,
} from './chatOutbox'
import { isExpired, MESSAGE_TTL_MS } from './expiry'
import type { ChatEntry, ChatStatus, ChatMessage, MessageReply, PresenceMember } from './chatTypes'
import type { ChatIdentity } from './identity'
import type { RoomReactionChange, RoomReactionRecord } from './chatReactions'

/**
 * Chat sync facade (oasis-game architecture): writes land locally first —
 * optimistic entry + durable IndexedDB outbox (images included) — and sync
 * in the background; network failures degrade to 'offline' and retry with
 * backoff, never blocking the UI nor dropping a word or photo.
 *
 * The one-hour rule lives here too: a sweeper flags entries whose hour ran
 * out (the UI plays the dissolve animation), then removes them locally and
 * cloud-deletes own rows so every client watches them go.
 */

export interface ChatCallbacks {
  /** Full list replace (history load, cache merge). Oldest → newest. */
  onSnapshot: (entries: ChatEntry[]) => void
  /** One entry added or updated (optimistic, confirmed, failed, expiring). */
  onEntry: (entry: ChatEntry) => void
  /** A message finished dissolving and is gone for good. */
  onRemoved: (id: string) => void
  /** A genuinely new message from another player arrived over Realtime. */
  onIncomingMessage: () => void
  onPresence: (members: PresenceMember[]) => void
  onStatus: (status: ChatStatus) => void
  onReactionSnapshot: (reactions: RoomReactionRecord[]) => void
  onReaction: (change: RoomReactionChange) => void
}

export interface ChatApi {
  send(content: string, imageBlob?: Blob, replyTo?: MessageReply | null): void
  /** Retry every failed/pending message right now. */
  retry(): void
  /** Load and prepend the page older than the current oldest message. */
  loadOlder(): Promise<{ loaded: number; hasMore: boolean }>
  /** Author deletes one own message: dissolve here, purge the cloud row. */
  remove(id: string): void
  /** Author edits one own message's text in place (no new row). */
  edit(id: string, content: string): void
  toggleReaction(messageId: string, emoji: string, active: boolean): Promise<boolean>
  updateIdentity(identity: ChatIdentity): void
  expireUserMessages(userId: string): void
  leave(): void
}

const RETRY_DELAYS_MS = [1000, 4000, 15000, 30000]
const MEMORY_CAP = 400
const INITIAL_PAGE = 60
/** Dissolve animation length — removal waits for it to finish. */
const DISSOLVE_MS = 1050
const SWEEP_INTERVAL_MS = 1000
/** Client-side purge fallback cadence (pg_cron stays the primary). */
const PURGE_INTERVAL_MS = 120_000

export function enterChat(
  initialIdentity: ChatIdentity,
  callbacks: ChatCallbacks,
): ChatApi {
  let entries: ChatEntry[] = []
  let currentIdentity = initialIdentity
  let handle: RoomHandle | null = null
  let flushing = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let sweepTimer: ReturnType<typeof setInterval> | null = null
  let purgeTimer: ReturnType<typeof setInterval> | null = null
  let firstPurgeTimer: ReturnType<typeof setTimeout> | null = null
  let closed = false
  let loadingOlder = false
  let hasMoreOlder = true
  let serverCursor: ChatCursor | null = null
  /** Object URLs for in-flight image previews, revoked on final removal. */
  const localUrls = new Map<string, string>()
  /** ids already flagged expiring (sweeper + DELETE broadcasts share this). */
  const expiringIds = new Set<string>()

  callbacks.onStatus('connecting')

  const emit = (entry: ChatEntry) => callbacks.onEntry(entry)

  // ---- local removal (after the dissolve animation has played) ----
  const dropEntry = (id: string) => {
    entries = entries.filter((e) => e.id !== id)
    callbacks.onRemoved(id)
    void removeFromOutbox(id)
    void removeChatCacheEntry(id)
    const url = localUrls.get(id)
    if (url) {
      localUrls.delete(id)
      URL.revokeObjectURL(url)
    }
  }

  const expireUserMessages = (userId: string) => {
    for (const entry of [...entries]) {
      if (entry.userId !== userId) continue
      // Best-effort cloud delete so other clients see the farewell even when
      // the profile trigger / purge RPC is unavailable.
      if (!entry.state) void handle?.deleteMessage(entry.id, imagePathOf(entry.imageUrl))
      dropEntry(entry.id)
    }
  }

  /** Flag the entry for its farewell animation, then remove it everywhere. */
  const beginExpire = (id: string, cloudDelete: boolean) => {
    if (expiringIds.has(id)) return
    const entry = entries.find((e) => e.id === id)
    if (!entry) return
    expiringIds.add(id)
    const flagged: ChatEntry = { ...entry, expiring: true }
    entries = replace(entries, flagged)
    emit(flagged)
      setTimeout(() => {
      // Someone may have re-added a row with this id (server echo after a
      // local delete race) — only drop what is still flagged.
      const still = entries.find((e) => e.id === id)
      if (!still?.expiring) {
        expiringIds.delete(id)
        return
      }
      dropEntry(id)
      expiringIds.delete(id)
    }, DISSOLVE_MS)
    if (cloudDelete) {
      void handle?.deleteMessage(id, imagePathOf(entry.imageUrl))
    }
  }

  const sweep = () => {
    if (closed) return
    const now = Date.now()
    for (const entry of entries) {
      if (!entry.expiring && isExpired(entry, now)) {
        beginExpire(entry.id, entry.userId === currentIdentity.userId && !entry.state)
      }
    }
  }

  const confirm = (id: string) => {
    const found = entries.find((e) => e.id === id)
    if (!found || (!found.state && found.serverCreatedAt)) return
    const entry: ChatEntry = { ...found }
    delete entry.state
    entries = replace(entries, entry)
    emit(entry)
  }

  /**
   * Overlay a server-confirmed row onto its optimistic echo: the object-URL
   * photo preview survives until the row carries its remote URL, at which
   * point the preview is released.
   */
  const mergeIntoEntry = (message: ChatMessage, existing?: ChatEntry): ChatEntry => {
    const merged: ChatEntry = { ...message }
    // Optimistic echo carried the author's look; a server row without it
    // (schema not migrated, older sender) keeps the local face.
    if (existing?.avatarStyle && !merged.avatarStyle) {
      merged.avatarStyle = existing.avatarStyle
    }
    if (existing?.avatarSeed && !merged.avatarSeed) {
      merged.avatarSeed = existing.avatarSeed
    }
    if (existing?.avatarUrl && !merged.avatarUrl) {
      merged.avatarUrl = existing.avatarUrl
    }
    if (existing?.replyTo && !merged.replyTo) {
      merged.replyTo = existing.replyTo
    }
    if (existing?.editedAt && !merged.editedAt) {
      merged.editedAt = existing.editedAt
    }
    if (existing?.localImage && !merged.imageUrl) {
      merged.localImage = existing.localImage
    } else if (existing?.localImage && merged.imageUrl) {
      const url = localUrls.get(existing.id)
      if (url) {
        localUrls.delete(existing.id)
        URL.revokeObjectURL(url)
      }
    }
    return merged
  }

  const fail = (id: string) => {
    const entry = entries.find((e) => e.id === id)
    if (!entry || entry.expiring) return
    const next = { ...entry, state: 'failed' as const }
    entries = replace(entries, next)
    emit(next)
  }

  const mergeServerMessage = (message: ChatMessage) => {
    const existing = entries.find((e) => e.id === message.id)
    if (existing && existing.expiring) return
    if (existing && existing.serverCreatedAt) {
      // Same confirmed row resent (refetch): keep as-is — unless the
      // content/image actually changed (an edit), in which case overlay.
      if (
        existing.content === message.content &&
        existing.imageUrl === message.imageUrl &&
        existing.replyTo?.content === message.replyTo?.content &&
        existing.editedAt === message.editedAt
      ) {
        return
      }
    }
    const merged = mergeIntoEntry(message, existing)
    entries = existing ? replace(entries, merged) : [...entries, merged].slice(-MEMORY_CAP)
    emit(merged)
    if (!existing && message.userId !== currentIdentity.userId && !isExpired(merged)) {
      callbacks.onIncomingMessage()
    }
    void saveChatCache(entries)
  }

  const removeRemote = (id: string) => {
    const entry = entries.find((e) => e.id === id)
    if (!entry || entry.expiring) return
    // Another client's row disappeared (author delete or the hourly purge):
    // play the same farewell, no cloud write needed from us.
    beginExpire(id, false)
  }

  const scheduleRetry = () => {
    if (closed || retryTimer) return
    void readOutbox().then((queue) => {
      if (closed || retryTimer) return
      const retrying = queue.find(
        (item) => item.attempts > 0 && item.attempts < CHAT_OUTBOX_MAX_ATTEMPTS,
      )
      if (!retrying) return
      const delay = RETRY_DELAYS_MS[
        Math.min(retrying.attempts - 1, RETRY_DELAYS_MS.length - 1)
      ]
      retryTimer = setTimeout(() => {
        retryTimer = null
        void flush()
      }, delay)
    })
  }

  const flush = async (): Promise<void> => {
    if (closed || !handle || flushing) return
    flushing = true
    try {
      let needsRetry = false
      // Drain: items enqueued while this pass was uploading arrived after
      // its snapshot — loop until a full pass finds nothing new. Without
      // this, multi-photo sends strand: slow conversions land mid-upload,
      // the running pass never sees them, and with no failure there is no
      // scheduled retry to pick them up either.
      const seen = new Set<string>()
      for (;;) {
        let attempted = false
        for (const item of await readOutbox()) {
          if (closed) break
          if (seen.has(item.id)) continue
          seen.add(item.id)
          attempted = true
          // The one-hour rule outlives a reconnect: an unsent draft whose
          // hour ran out while the tab was closed departs with the farewell
          // animation instead of going out with a fresh server-side hour.
          if (Date.now() - item.at >= MESSAGE_TTL_MS) {
            beginExpire(item.id, false)
            try {
              await removeFromOutbox(item.id)
            } catch {
              // Cache cleanup is best-effort; the row is already gone.
            }
            continue
          }
          if (item.attempts >= CHAT_OUTBOX_MAX_ATTEMPTS) {
            fail(item.id)
            continue
          }
          let result: { ok: boolean; error?: string }
          try {
            result = await handle.send({
              id: item.id,
              content: item.content,
              replyTo: item.replyTo,
              displayName: item.displayName,
              avatar: item.avatar,
              avatarUrl: item.avatarUrl ?? null,
              imageBlob: item.imageBlob,
            })
          } catch {
            // One bad item must never wedge the queue (and the flush lock):
            // treat it like a network error and move on to the next item.
            result = { ok: false, error: 'network' }
          }
          if (result.ok) {
            try {
              await removeFromOutbox(item.id)
            } catch {
              // The server already has it — confirm locally anyway so the
              // row doesn't sit in "sending" forever on an IDB hiccup. The
              // leftover outbox copy re-sends idempotently (upsert path +
              // duplicate-id insert counts as sent — see chatRemote.send).
            }
            confirm(item.id)
          } else if (result.error === 'rejected') {
            try {
              await exhaustOutboxItem(item.id)
            } catch {
              // Counter unwritable — fail the row anyway; reload replays it.
            }
            fail(item.id)
          } else {
            needsRetry = true
            try {
              const exhausted = await markOutboxFailed(item.id)
              if (exhausted) fail(item.id)
            } catch {
              // Attempt counter unwritable — leave pending; the next flush
              // (or a reload replay) will try again.
            }
          }
        }
        if (!attempted || closed) break
      }
      if (needsRetry && !closed) scheduleRetry()
    } finally {
      flushing = false
    }
  }

  // ---- startup: cache first, outbox previews, then the network ----
  void (async () => {
    // Sweep expired rows (incl. vanished authors) before reading the cache,
    // so a stale local copy cannot resurrect a message the cloud forgot.
    await purgeExpiredRemote()
    if (closed) return
    const [cached, outbox] = await Promise.all([loadChatCache(), readOutbox()])
    if (closed) return
    // Drop cached rows the cloud no longer has (profile expiry / purge).
    const cachedIds = cached.filter((entry) => !entry.state).map((entry) => entry.id)
    const existing = await fetchExistingMessageIds(cachedIds)
    let validCached = cached
    if (existing) {
      const staleIds = cachedIds.filter((id) => !existing.has(id))
      if (staleIds.length > 0) {
        await Promise.all(staleIds.map((id) => removeChatCacheEntry(id)))
      }
      validCached = cached.filter((entry) => entry.state || existing.has(entry.id))
    }
    const live = validCached.filter((entry) => !isExpired(entry)).slice(-INITIAL_PAGE)
    // Unsent drafts come back as pending entries with their photo preview.
    const pending: ChatEntry[] = []
    for (const item of outbox) {
      const optimistic: ChatEntry = {
        id: item.id,
        userId: currentIdentity.userId,
        displayName: item.displayName,
        avatarStyle: item.avatar?.style ?? null,
        avatarSeed: item.avatar?.seed ?? null,
        avatarUrl: item.avatarUrl ?? null,
        content: item.content,
        replyTo: item.replyTo ?? null,
        at: item.at,
        state: 'pending',
      }
      if (item.imageBlob) {
        const url = URL.createObjectURL(item.imageBlob)
        localUrls.set(item.id, url)
        optimistic.localImage = url
      }
      pending.push(optimistic)
    }
    entries = [...live, ...pending].sort(compareEntries).slice(-MEMORY_CAP)
    if (entries.length > 0) callbacks.onSnapshot(entries)
    void saveChatCache(entries)
    // Rows that expired while the tab was closed leave the store now.
    void pruneChatCache()
  })()

  const syncFromServer = async () => {
    if (closed) return
    await purgeExpiredRemote()
    if (closed) return
    // Drop entries the cloud no longer has (vanished authors / purge) so a
    // refresh cannot keep showing a message the server already forgot.
    const confirmedIds = entries.filter((entry) => !entry.state && !entry.expiring).map((entry) => entry.id)
    const existing = await fetchExistingMessageIds(confirmedIds)
    if (existing && !closed) {
      for (const id of confirmedIds) {
        if (!existing.has(id)) {
          const entry = entries.find((e) => e.id === id)
          if (entry && !entry.expiring) dropEntry(id)
        }
      }
    }
    if (closed) return
    const page = await fetchChatPage()
    if (closed || !page) return
    hasMoreOlder = page.hasMore
    if (page.messages.length > 0) {
      serverCursor = {
        createdAt: page.messages[0].serverCreatedAt!,
        id: page.messages[0].id,
      }
    }
    // Merge the authoritative page over whatever cache/outbox restored:
    // confirmed rows win, cached-but-older rows survive beneath the page.
    const byId = new Map(entries.map((entry) => [entry.id, entry]))
    for (const message of page.messages) {
      byId.set(message.id, mergeIntoEntry(message, byId.get(message.id)))
    }
    entries = [...byId.values()]
      .filter((entry) => entry.state || !isExpired(entry))
      .sort(compareEntries)
      .slice(-MEMORY_CAP)
    callbacks.onSnapshot(entries)
    void saveChatCache(entries)
  }

  // Initial authoritative fetch.
  void syncFromServer()

  // Catch-up after the tab/app was backgrounded or the realtime socket
  // dropped silently: browsers throttle/suspend background tabs, so the
  // postgres_changes stream can miss rows. Re-pulling on visibility/focus
  // (and on a slow heartbeat) guarantees eventual consistency.
  const onVisible = () => {
    if (document.hidden) return
    window.setTimeout(syncFromServer, 200)
    window.setTimeout(() => {
      if (!closed) void flush()
    }, 300)
  }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', onVisible)
  window.addEventListener('pageshow', onVisible)
  const syncTimer = setInterval(syncFromServer, 120_000)

  void joinChatRoom({
    presenceKey: currentIdentity.userId,
    onMessage: mergeServerMessage,
    onDeleted: removeRemote,
    onReactionSnapshot: callbacks.onReactionSnapshot,
    onReaction: callbacks.onReaction,
    onPresence: callbacks.onPresence,
    onStatus: (status) => {
      if (closed) return
      if (status === 'open') {
        handle?.track(currentIdentity)
        callbacks.onStatus('online')
        void flush()
      } else if (status === 'error' || status === 'closed') {
        callbacks.onStatus('offline')
        scheduleRetry()
      }
    },
  }).then((joined) => {
    if (closed) {
      joined?.leave()
      return
    }
    handle = joined
    if (!joined) {
      callbacks.onStatus('offline')
      return
    }
    joined.track(currentIdentity)
    void flush()
  }).catch(() => {
    if (!closed) callbacks.onStatus('offline')
  })

  sweepTimer = setInterval(sweep, SWEEP_INTERVAL_MS)

  // Cloud purge fallback: any online player sweeps the room's expired
  // rows, so the promise holds even where pg_cron is not scheduled.
  firstPurgeTimer = setTimeout(
    () => {
      firstPurgeTimer = null
      void purgeExpiredRemote()
    },
    8_000 + Math.floor(Math.random() * 15_000),
  )
  purgeTimer = setInterval(() => {
    void purgeExpiredRemote()
  }, PURGE_INTERVAL_MS)

  return {
    send(content, imageBlob, replyTo) {
      const trimmed = content.trim()
      if ((!trimmed && !imageBlob) || closed) return
      const item: ChatOutboxItem = {
        id: newId(),
        content: trimmed,
        replyTo: replyTo ?? null,
        displayName: currentIdentity.displayName,
        avatar: currentIdentity.avatar ?? undefined,
        avatarUrl: currentIdentity.avatarUrl,
        at: Date.now(),
        attempts: 0,
      }
      if (imageBlob) item.imageBlob = imageBlob
      const entry: ChatEntry = {
        id: item.id,
        userId: currentIdentity.userId,
        displayName: currentIdentity.displayName,
        avatarStyle: currentIdentity.avatar?.style ?? null,
        avatarSeed: currentIdentity.avatar?.seed ?? null,
        avatarUrl: currentIdentity.avatarUrl,
        content: trimmed,
        replyTo: replyTo ?? null,
        at: item.at,
        state: 'pending',
      }
      if (imageBlob) {
        const url = URL.createObjectURL(imageBlob)
        localUrls.set(item.id, url)
        entry.localImage = url
      }
      entries = [...entries, entry].slice(-MEMORY_CAP)
      emit(entry)
      void enqueueOutbox(item).then(() => flush())
    },
    retry() {
      // Reset nothing: failed attempts keep their budget; a manual retry
      // just runs the queue again immediately.
      void flush()
    },
    remove(id) {
      const entry = entries.find((e) => e.id === id)
      if (!entry || entry.expiring) return
      if (entry.userId !== currentIdentity.userId) return
      // Pending/failed rows never reached the cloud — the farewell alone is
      // enough (dropEntry also clears their outbox slot).
      beginExpire(id, !entry.state)
    },
    edit(id, content) {
      const entry = entries.find((e) => e.id === id)
      if (!entry || entry.expiring) return
      if (entry.userId !== currentIdentity.userId) return
      const trimmed = content.trim()
      // Pending/failed rows live in the outbox — patch the queued copy too.
      if (entry.state) {
        const updated: ChatEntry = { ...entry, content: trimmed }
        entries = replace(entries, updated)
        emit(updated)
        void saveChatCache(entries)
        void updateOutboxContent(id, trimmed)
        return
      }
      const previousContent = entry.content
      const updated: ChatEntry = {
        ...entry,
        content: trimmed,
        editedAt: new Date().toISOString(),
      }
      entries = replace(entries, updated)
      emit(updated)
      void saveChatCache(entries)
      void (async () => {
        if (!handle) return
        const result = await handle.updateMessage(id, trimmed)
        if (result.ok) return
        // Revert on a hard failure so the row doesn't lie about its text.
        const current = entries.find((e) => e.id === id)
        if (current && current.content === trimmed) {
          const reverted: ChatEntry = { ...current, content: previousContent, editedAt: entry.editedAt }
          entries = replace(entries, reverted)
          emit(reverted)
          void saveChatCache(entries)
        }
      })()
    },
    toggleReaction(messageId, emoji, active) {
      if (closed || !handle) return Promise.resolve(false)
      return handle.toggleReaction(messageId, emoji, active)
    },
    async loadOlder() {
      if (closed || loadingOlder || !hasMoreOlder) {
        return { loaded: 0, hasMore: hasMoreOlder }
      }
      const oldest = entries.find((entry) => !entry.state)
      if (!oldest) return { loaded: 0, hasMore: false }
      loadingOlder = true
      try {
        const displayBefore = cursorFor(oldest)
        // Local cache first — only hit the server when it runs dry.
        const cachedPage = (
          await loadChatCacheBefore(
            { createdAt: new Date(displayBefore.createdAt).getTime(), id: displayBefore.id },
            60,
          )
        ).filter((entry) => !isExpired(entry))
        if (cachedPage.length > 0 && !entries.some((e) => e.id === cachedPage[0].id)) {
          const byId = new Map(entries.map((entry) => [entry.id, entry]))
          for (const entry of cachedPage) byId.set(entry.id, entry)
          entries = [...byId.values()].sort(compareEntries).slice(-MEMORY_CAP)
          callbacks.onSnapshot(entries)
          return { loaded: cachedPage.length, hasMore: true }
        }
        const page = await fetchChatPage(serverCursor ?? displayBefore)
        if (!page || closed) {
          hasMoreOlder = cachedPage.length >= 60 || hasMoreOlder
          return { loaded: cachedPage.length, hasMore: hasMoreOlder }
        }
        hasMoreOlder = page.hasMore
        if (page.messages.length > 0) {
          serverCursor = {
            createdAt: page.messages[0].serverCreatedAt!,
            id: page.messages[0].id,
          }
        } else {
          serverCursor = null
        }
        const byId = new Map(entries.map((entry) => [entry.id, entry]))
        for (const message of page.messages) {
          byId.set(message.id, mergeIntoEntry(message, byId.get(message.id)))
        }
        entries = [...byId.values()].sort(compareEntries).slice(-MEMORY_CAP)
        callbacks.onSnapshot(entries)
        void saveChatCache(entries)
        return { loaded: page.messages.length, hasMore: hasMoreOlder }
      } finally {
        loadingOlder = false
      }
    },
    updateIdentity(next) {
      currentIdentity = next
      handle?.track(next)
    },
    expireUserMessages,
    leave() {
      closed = true
      if (retryTimer) clearTimeout(retryTimer)
      if (sweepTimer) clearInterval(sweepTimer)
      if (purgeTimer) clearInterval(purgeTimer)
      if (firstPurgeTimer) clearTimeout(firstPurgeTimer)
      if (syncTimer) clearInterval(syncTimer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('pageshow', onVisible)
      handle?.leave()
      handle = null
    },
  }
}

/** Storage path of a chat photo URL (`…/object/public/chat-images/<path>`). */
function imagePathOf(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  const marker = 'chat-images/'
  const idx = imageUrl.indexOf(marker)
  if (idx === -1) return null
  return imageUrl.slice(idx + marker.length)
}

function cursorFor(entry: ChatEntry): ChatCursor {
  return {
    createdAt: entry.serverCreatedAt ?? new Date(entry.at).toISOString(),
    id: entry.id,
  }
}

function replace(list: ChatEntry[], entry: ChatEntry): ChatEntry[] {
  const index = list.findIndex((e) => e.id === entry.id)
  if (index === -1) return [...list, entry].slice(-MEMORY_CAP)
  const next = list.slice()
  next[index] = entry
  return next
}

function newId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  )
}
