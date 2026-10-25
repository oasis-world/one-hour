/**
 * The one-hour rule: every message lives for exactly one hour, locally and
 * in the cloud. The countdown anchors on the server's created_at when known
 * (all clients agree), else on the local send time until the row confirms.
 */

export const MESSAGE_TTL_MS = 60 * 60 * 1000

interface Expirable {
  at: number
  serverCreatedAt?: string
}

export function expiresAtOf(entry: Expirable): number {
  const anchor = entry.serverCreatedAt
    ? new Date(entry.serverCreatedAt).getTime()
    : entry.at
  return anchor + MESSAGE_TTL_MS
}

export function remainingMs(entry: Expirable, now = Date.now()): number {
  return Math.max(0, expiresAtOf(entry) - now)
}

export function isExpired(entry: Expirable, now = Date.now()): boolean {
  return remainingMs(entry, now) <= 0
}

/** Stable sort key: server time when present, local send time otherwise. */
export function entrySortKey(entry: Expirable): number {
  return entry.serverCreatedAt ? new Date(entry.serverCreatedAt).getTime() : entry.at
}
