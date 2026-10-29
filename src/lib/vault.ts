/**
 * Multi-store fallback for small values that must survive a localStorage
 * wipe (anonymous Supabase session tokens, local uid, profile, expiry).
 *
 * localStorage stays the primary store; IndexedDB and a cookie act as
 * mirrors. Cookie is synchronous (so a wiped localStorage can be recovered
 * during the first synchronous read); IndexedDB is async and is consulted
 * before we give up and mint a fresh identity.
 *
 * Values are strings. Keep them small (auth session JSON is ~1-2 KB).
 */
import { idbKvDelete, idbKvGet, idbKvSet } from './idb'

const COOKIE_MAX_AGE = 60 * 60 // one hour — matches the anonymous lifetime

export const VAULT_KEYS = {
  session: 'one-hour-vault:session', // JSON { access_token, refresh_token }
  localUid: 'one-hour-vault:local-uid',
  profile: 'one-hour-vault:profile',
  expiry: 'one-hour-vault:expiry',
} as const

function cookieName(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, '_')
}

function setCookie(name: string, value: string): void {
  try {
    if (typeof document === 'undefined') return
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  } catch {
    // Private mode / SSR: best effort.
  }
}

function getCookie(name: string): string | null {
  try {
    if (typeof document === 'undefined') return null
    const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))
    if (!match) return null
    return decodeURIComponent(match.slice(name.length + 1))
  } catch {
    return null
  }
}

function deleteCookie(name: string): void {
  try {
    if (typeof document === 'undefined') return
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
  } catch {
    // best effort
  }
}

/** Synchronous read: localStorage first, then cookie. */
export function vaultGetSync(key: string): string | null {
  try {
    const ls = globalThis.localStorage?.getItem(key)
    if (ls) return ls
  } catch {
    // fall through
  }
  return getCookie(cookieName(key))
}

/** Async read: localStorage, cookie, then IndexedDB. */
export async function vaultGet(key: string): Promise<string | null> {
  const sync = vaultGetSync(key)
  if (sync) return sync
  try {
    const idb = await idbKvGet(key)
    if (idb) return idb
  } catch {
    // best effort
  }
  return null
}

/** Write to every available store. */
export function vaultSet(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    // best effort
  }
  setCookie(cookieName(key), value)
  void idbKvSet(key, value)
}

/** Remove from every store. */
export function vaultRemove(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key)
  } catch {
    // best effort
  }
  deleteCookie(cookieName(key))
  void idbKvDelete(key)
}