import { getLang, type Lang } from './i18n'

/**
 * Player nickname storage, oasis-game pattern: anonymous players chat
 * under a locally-persisted 旅人-ab12 / Traveler-ab12 name. Switching
 * language keeps the suffix and swaps the prefix.
 */

const NICKNAME_KEY = 'one-hour-nickname'
const AUTO_NAME_RE = /^(旅人|Traveler)-([a-z0-9]{4})$/

export function isAutoTravelerName(name: string): boolean {
  return AUTO_NAME_RE.test(name)
}

/** Local fallback nickname, persisted so it survives refreshes. */
export function loadChatNickname(lang: Lang = getLang()): string {
  try {
    const stored = globalThis.localStorage?.getItem(NICKNAME_KEY)
    if (stored) {
      const auto = AUTO_NAME_RE.exec(stored)
      if (auto) return travelerName(auto[2], lang)
      return stored
    }
  } catch {
    // Private mode: fall through to a per-session random name.
  }
  const nickname = travelerName(Math.random().toString(36).slice(2, 6), lang)
  saveNickname(nickname)
  return nickname
}

export function saveNickname(nickname: string): void {
  try {
    globalThis.localStorage?.setItem(NICKNAME_KEY, nickname)
  } catch {
    // Private mode: nickname lives for this session only.
  }
}

function travelerName(suffix: string, lang: Lang): string {
  return `${lang === 'en' ? 'Traveler' : '旅人'}-${suffix}`
}
