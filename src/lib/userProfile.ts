import { useEffect, useState } from 'react'
import { getLang, type Lang } from './i18n'
import { isKnownStyle, randomAvatarLook, type AvatarLook } from './avatar'

/**
 * Local player profile: the nickname + DiceBear look confirmed in the
 * welcome flow (or later edited on the profile page). Lives in
 * localStorage for guests; a signed-in player's copy also syncs to the
 * cloud `profiles` table (see profileCloud.ts).
 */

export interface UserProfile extends AvatarLook {
  nickname: string
  /** Custom photo avatar (public storage URL); wins over style + seed. */
  avatarUrl?: string | null
}

/** Schema guardrail shared with the cloud table (char_length 1..40). */
export const NICKNAME_MAX = 20

const PROFILE_KEY = 'one-hour-user-profile'

let cached: UserProfile | null | undefined
const listeners = new Set<(p: UserProfile | null) => void>()

export function loadUserProfile(): UserProfile | null {
  if (cached !== undefined) return cached
  try {
    const raw = globalThis.localStorage?.getItem(PROFILE_KEY)
    cached = raw ? parseProfile(raw) : null
  } catch {
    cached = null
  }
  return cached
}

export function saveUserProfile(profile: UserProfile): void {
  cached = profile
  try {
    globalThis.localStorage?.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    // Private mode: profile lives for this session only.
  }
  for (const fn of listeners) fn(profile)
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
  const cleaned = input.replace(/\s+/g, ' ').trim().slice(0, NICKNAME_MAX)
  return cleaned
}

/** A whole new random identity — the welcome screen's refresh action. */
export function randomProfile(
  previous?: UserProfile | null,
  lang: Lang = getLang(),
): UserProfile {
  return {
    nickname: randomNickname(previous?.nickname, lang),
    ...randomAvatarLook(previous),
    // A fresh generated identity drops any custom photo.
    avatarUrl: null,
  }
}

/* ---- random nicknames: a mood word + a wanderer noun ---- */

const NICK_ZH_A = [
  '晚风', '星光', '微光', '云端', '远山', '落雪',
  '潮汐', '银河', '薄雾', '暖阳', '极光', '夜航',
]
const NICK_ZH_B = [
  '旅人', '候鸟', '灯塔', '星轨', '观星者', '拾贝人',
  '漫游者', '萤火虫', '信使', '鲸', '猫', '邮差',
]
const NICK_EN_A = [
  'Amber', 'Misty', 'Stellar', 'Lunar', 'Quiet', 'Drifting',
  'Velvet', 'Cobalt', 'Snowy', 'Ember', 'Aurora', 'Midnight',
]
const NICK_EN_B = [
  'Traveler', 'Crane', 'Whale', 'Lantern', 'Comet', 'Fox',
  'Sparrow', 'Beacon', 'Wanderer', 'Firefly', 'Curator', 'Pilgrim',
]

export function randomNickname(previous?: string | null, lang: Lang = getLang()): string {
  const a = lang === 'zh' ? NICK_ZH_A : NICK_EN_A
  const b = lang === 'zh' ? NICK_ZH_B : NICK_EN_B
  const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]
  let name = `${pick(a)}${pick(b)}`
  while (previous != null && previous !== '' && name === previous) {
    name = `${pick(a)}${pick(b)}`
  }
  return name
}
