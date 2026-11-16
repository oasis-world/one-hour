import { useEffect, useState } from 'react'
import { getLang, type Lang } from './i18n'
import { isKnownStyle, randomAvatarLook, type AvatarLook } from './avatar'
import { randomNickname, randomRole } from './randomIdentity'
import { VAULT_KEYS, vaultGetSync, vaultRemove, vaultSet } from './vault'

// Callers import the generators from here; the word banks live in
// nameData.ts / randomIdentity.ts to keep this module storage-focused.
export { randomNickname, randomRole } from './randomIdentity'

/**
 * Local player profile: the nickname + avatar look confirmed in the
 * welcome flow (or later edited on the profile page). Lives in
 * localStorage for guests; a signed-in player's copy also syncs to the
 * cloud `profiles` table (see profileCloud.ts).
 */

export interface UserProfile extends AvatarLook {
  nickname: string
  /** Free-text role/title shown next to the nickname (e.g. student, engineer). */
  role?: string
  /** Custom photo avatar (public storage URL); wins over style + seed. */
  avatarUrl?: string | null
}

/** Schema guardrail shared with the cloud table (char_length 1..40). */
export const NICKNAME_MAX = 32
export const ROLE_MAX = 32
export const PROFILE_LIFETIME_MS = 60 * 60 * 1000

const PROFILE_KEY = 'one-hour-user-profile'

let cached: UserProfile | null | undefined
const listeners = new Set<(p: UserProfile | null) => void>()

export function loadUserProfile(): UserProfile | null {
  if (cached !== undefined) return cached
  try {
    let raw = globalThis.localStorage?.getItem(PROFILE_KEY)
    if (!raw) raw = vaultGetSync(VAULT_KEYS.profile)
    if (raw) {
      // Heal the primary store if it was wiped.
      try {
        globalThis.localStorage?.setItem(PROFILE_KEY, raw)
      } catch {
        // best effort
      }
      cached = parseProfile(raw)
    } else {
      cached = null
    }
  } catch {
    cached = null
  }
  return cached
}

export function saveUserProfile(profile: UserProfile): void {
  cached = profile
  const raw = JSON.stringify(profile)
  try {
    globalThis.localStorage?.setItem(PROFILE_KEY, raw)
  } catch {
    // Private mode: profile lives for this session only.
  }
  vaultSet(VAULT_KEYS.profile, raw)
  for (const fn of listeners) fn(profile)
}

export function clearUserProfile(): void {
  cached = null
  try {
    globalThis.localStorage?.removeItem(PROFILE_KEY)
  } catch {
    // Private mode: nothing persisted.
  }
  vaultRemove(VAULT_KEYS.profile)
  for (const fn of listeners) fn(null)
}

export function resetPreWelcome(): void {
  preWelcome = null
}

const PROFILE_EXPIRES_KEY = 'one-hour-profile-expires-at'

export function setProfileExpiresAt(ts: number): void {
  const raw = String(ts)
  try {
    globalThis.localStorage?.setItem(PROFILE_EXPIRES_KEY, raw)
  } catch {
    // Private mode: expiry lives for this session only.
  }
  vaultSet(VAULT_KEYS.expiry, raw)
}

export function getProfileExpiresAt(): number | null {
  try {
    let raw = globalThis.localStorage?.getItem(PROFILE_EXPIRES_KEY)
    if (!raw) raw = vaultGetSync(VAULT_KEYS.expiry)
    if (!raw) return null
    const n = Number(raw)
    if (Number.isFinite(n)) {
      // Heal primary store.
      try {
        globalThis.localStorage?.setItem(PROFILE_EXPIRES_KEY, raw)
      } catch {
        // best effort
      }
      return n
    }
    return null
  } catch {
    return null
  }
}

export function clearProfileExpiresAt(): void {
  try {
    globalThis.localStorage?.removeItem(PROFILE_EXPIRES_KEY)
  } catch {
    // Private mode: nothing persisted.
  }
  vaultRemove(VAULT_KEYS.expiry)
}

export function subscribeProfile(fn: (p: UserProfile | null) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useUserProfile(): UserProfile | null {
  const [profile, setProfile] = useState<UserProfile | null>(loadUserProfile)
  useEffect(() => subscribeProfile(setProfile), [])
  return profile
}

function parseProfile(raw: string): UserProfile | null {
  try {
    const data = JSON.parse(raw) as Partial<UserProfile>
    if (
      typeof data.nickname === 'string' &&
      data.nickname.length > 0 &&
      typeof data.seed === 'string' &&
      data.seed.length > 0 &&
      isKnownStyle(data.style)
    ) {
      return {
        nickname: data.nickname,
        role: typeof data.role === 'string' ? data.role.slice(0, ROLE_MAX) : '',
        style: data.style,
        seed: data.seed,
        avatarUrl: typeof data.avatarUrl === 'string' && data.avatarUrl ? data.avatarUrl : null,
      }
    }
  } catch {
    // Corrupt row: treat as a brand-new player.
  }
  return null
}

/** Trim + collapse whitespace + hard length cap, mirroring the table check. */
export function cleanNickname(input: string): string {
  return input.replace(/\s+/g, ' ').trim().slice(0, NICKNAME_MAX)
}

export function cleanRole(input: string): string {
  return input.replace(/\s+/g, ' ').trim().slice(0, ROLE_MAX)
}

/** A whole new random identity — the welcome screen's refresh action. */
export function randomProfile(
  previous?: UserProfile | null,
  lang: Lang = getLang(),
): UserProfile {
  return {
    nickname: randomNickname(previous?.nickname, lang),
    role: randomRole(previous?.role, lang),
    ...randomAvatarLook(previous),
    // A fresh generated identity drops any custom photo.
    avatarUrl: null,
  }
}

let preWelcome: UserProfile | null = null

/**
 * The random identity the room shows before the welcome confirm — rolled
 * once per session and shared by the identity layer, the top bar and the
 * welcome gate, so the face and name behind the modal are exactly the ones
 * the modal first offers. Confirming the gate saves it for real.
 */
export function preWelcomeProfile(): UserProfile {
  preWelcome ??= randomProfile(null)
  return preWelcome
}
