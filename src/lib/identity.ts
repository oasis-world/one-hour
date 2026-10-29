import type { AccountState } from './account'
import { isSupabaseConfigured } from './supabaseConfig'
import type { AvatarLook } from './avatar'
import { loadUserProfile, preWelcomeProfile } from './userProfile'
import { VAULT_KEYS, vaultGetSync, vaultRemove, vaultSet } from './vault'

/** Room identity: every visitor gets one via anonymous sign-in. */
export interface ChatIdentity {
  userId: string
  displayName: string
  /** DiceBear look broadcast through presence. */
  avatar: AvatarLook | null
  /** Custom photo avatar URL; wins over the generated look. */
  avatarUrl: string | null
}

const LOCAL_UID_KEY = 'one-hour-local-uid'

export function resolveChatIdentity(account: AccountState): ChatIdentity | null {
  // Before the welcome confirm the shared random draft plays the part, so
  // the room (top bar, presence) shows the very identity the gate offers.
  const profile = loadUserProfile() ?? preWelcomeProfile()
  const displayName = profile.nickname
  const avatar: AvatarLook | null = { style: profile.style, seed: profile.seed }
  const avatarUrl = profile.avatarUrl ?? null
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

/** Clear the persisted local uid so a fresh anonymous identity is minted. */
export function resetLocalUserId(): void {
  vaultRemove(LOCAL_UID_KEY)
  vaultRemove(VAULT_KEYS.localUid)
}

/** Stable per-browser id for the no-backend local mode. */
function localUserId(): string {
  try {
    const stored =
      globalThis.localStorage?.getItem(LOCAL_UID_KEY) ??
      vaultGetSync(VAULT_KEYS.localUid)
    if (stored) {
      vaultSet(LOCAL_UID_KEY, stored)
      vaultSet(VAULT_KEYS.localUid, stored)
      return stored
    }
    const generated = `local-${Math.random().toString(36).slice(2, 10)}`
    vaultSet(LOCAL_UID_KEY, generated)
    vaultSet(VAULT_KEYS.localUid, generated)
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
