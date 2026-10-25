import type { AccountState } from './account'
import { isSupabaseConfigured } from './supabaseConfig'
import type { AvatarLook } from './avatar'
import { loadUserProfile, randomNickname } from './userProfile'

/** Room identity: every visitor gets one via anonymous sign-in. */
export interface ChatIdentity {
  userId: string
  displayName: string
  /** DiceBear look broadcast through presence; null until picked. */
  avatar: AvatarLook | null
  /** Custom photo avatar URL; wins over the generated look. */
  avatarUrl: string | null
}

const LOCAL_UID_KEY = 'one-hour-local-uid'

/** Stable per-session name for the moments before the welcome confirm. */
let preWelcomeName: string | null = null

export function resolveChatIdentity(account: AccountState): ChatIdentity | null {
  const profile = loadUserProfile()
  const displayName = profile?.nickname ?? (preWelcomeName ??= randomNickname())
  const avatar: AvatarLook | null = profile
    ? { style: profile.style, seed: profile.seed }
    : null
  const avatarUrl = profile?.avatarUrl ?? null
  if (account.userId) {
    return { userId: account.userId, displayName, avatar, avatarUrl }
  }
  // Supabase unconfigured: run as a purely local player so the room (and
  // its one-hour rule) works end-to-end without any backend.
  if (!isSupabaseConfigured()) {
    return { userId: localUserId(), displayName, avatar, avatarUrl }
  }
  return null
}

/** Stable per-browser id for the no-backend local mode. */
function localUserId(): string {
  try {
    const stored = globalThis.localStorage?.getItem(LOCAL_UID_KEY)
    if (stored) return stored
    const generated = `local-${Math.random().toString(36).slice(2, 10)}`
    globalThis.localStorage?.setItem(LOCAL_UID_KEY, generated)
    return generated
  } catch {
    return `local-session-${Math.random().toString(36).slice(2, 10)}`
  }
}

/** Stable accent hue per user id — avatar tint and name color. */
export function userHue(userId: string): number {
  const hues = [16, 145, 205, 265, 330, 40, 95, 235]
  let hash = 0
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return hues[hash % hues.length]
}

/** Author name color, tuned per theme via CSS vars. */
export function userNameColor(userId: string): string {
  return `hsl(${userHue(userId)} var(--name-hue-saturation) var(--name-hue-lightness))`
}

/** Avatar tile tint (always light — the glyph is dark). */
export function userAvatarTint(userId: string): string {
  return `hsl(${userHue(userId)} 46% 78%)`
}
