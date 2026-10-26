import {
  DEFAULT_COUNTDOWN_ANIMATION,
  isCountdownAnimation,
  type CountdownAnimation,
} from './countdownAnimations'

/**
 * Local settings (persisted): chat veil opacity — the background alpha of
 * the message list, adjustable from the future settings dialog — plus the
 * warm/dark theme override. Components only read the applied CSS vars.
 */

const VEIL_KEY = 'one-hour-veil'
const THEME_KEY = 'one-hour-theme'
const BG_TTL_KEY = 'one-hour-bg-ttl'
const COUNTDOWN_ANIMATION_KEY = 'one-hour-countdown-animation'

export type ThemeName = 'warm' | 'dark'

export function loadCountdownAnimation(): CountdownAnimation {
  try {
    const value = globalThis.localStorage?.getItem(COUNTDOWN_ANIMATION_KEY)
    return value && isCountdownAnimation(value) ? value : DEFAULT_COUNTDOWN_ANIMATION
  } catch {
    return DEFAULT_COUNTDOWN_ANIMATION
  }
}

export function saveCountdownAnimation(animation: CountdownAnimation): void {
  try {
    globalThis.localStorage?.setItem(COUNTDOWN_ANIMATION_KEY, animation)
  } catch {
    // Private mode: the choice remains active for this session.
  }
}

export const VEIL_MIN = 0
export const VEIL_MAX = 0.92
/** Default chat-list opacity — high enough that messages read over any photo. */
export const VEIL_DEFAULT = 0.62

/** A backdrop photo holds the screen for at most this long. */
export const BG_TTL_DEFAULT_MS = 10 * 60 * 1000
export const BG_TTL_MIN_MS = 15 * 1000

export function loadVeil(): number {
  try {
    const raw = globalThis.localStorage?.getItem(VEIL_KEY)
    const parsed = raw == null ? NaN : Number(raw)
    if (!Number.isFinite(parsed)) return VEIL_DEFAULT
    return Math.min(VEIL_MAX, Math.max(VEIL_MIN, parsed))
  } catch {
    return VEIL_DEFAULT
  }
}

export function saveVeil(value: number): void {
  try {
    globalThis.localStorage?.setItem(
      VEIL_KEY,
      String(Math.min(VEIL_MAX, Math.max(VEIL_MIN, value))),
    )
  } catch {
    // Private mode: settings live for this session only.
  }
}

/** Saved theme, or null when the OS preference should decide. */
export function loadTheme(): ThemeName | null {
  try {
    const raw = globalThis.localStorage?.getItem(THEME_KEY)
    return raw === 'warm' || raw === 'dark' ? raw : null
  } catch {
    return null
  }
}

export function saveTheme(theme: ThemeName | null): void {
  try {
    if (theme) globalThis.localStorage?.setItem(THEME_KEY, theme)
    else globalThis.localStorage?.removeItem(THEME_KEY)
  } catch {
    // Private mode.
  }
}

export function loadBgTtlMs(): number {
  try {
    const raw = globalThis.localStorage?.getItem(BG_TTL_KEY)
    const parsed = raw == null ? NaN : Number(raw)
    if (!Number.isFinite(parsed)) return BG_TTL_DEFAULT_MS
    return Math.max(BG_TTL_MIN_MS, Math.round(parsed))
  } catch {
    return BG_TTL_DEFAULT_MS
  }
}

export function saveBgTtlMs(ms: number): void {
  try {
    globalThis.localStorage?.setItem(BG_TTL_KEY, String(Math.max(BG_TTL_MIN_MS, Math.round(ms))))
  } catch {
    // Private mode.
  }
}
