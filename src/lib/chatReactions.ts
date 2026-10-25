/**
 * Local emoji reactions for the chat room — ported from the oasis room
 * chat. Reactions live in localStorage (no cloud table: sharing them
 * across clients would need a `chat_reactions` table + Realtime fan-out,
 * deliberately left as the follow-up, same as oasis). The shape mirrors
 * what such a table would serve so the UI can swap sources unchanged.
 */

export type RoomReactionMap = Record<string, { count: number; own: boolean }>

export type RoomReactionState = Record<string, RoomReactionMap>

const STORE_KEY = 'one-hour-chat-reactions:global'

/** Player-global quick-emoji habits (input habit, not per room). */
const QUICK_KEY = 'one-hour-chat-quick-emoji'

/** How many recent picks are remembered; the row itself only shows up to 6. */
const MAX_RECENT = 12

/**
 * Default quick row, in order: hover bar shows the first 4, the right-click
 * menu the first 6. Recently used emojis jump ahead of these (see
 * getQuickEmojis) but never duplicate them.
 */
export const QUICK_EMOJIS = ['👍', '❤️', '👏', '🔥', '😄', '☕'] as const

/**
 * Full palette behind the "Add Reaction" menu item — popular + decorative,
 * roughly grouped (faces → gestures → symbols → fun).
 */
export const REACTION_PALETTE = [
  '👍', '❤️', '😂', '😄', '😮', '😢', '🎉', '🔥', '👏',
  '🥰', '😍', '🤣', '😭', '🙏', '💯', '🎊', '✨',
  '🌹', '🍀', '⭐', '👌', '🤝', '💪', '🥳', '😎',
  '🤔', '👀', '🍎', '🍜', '☕', '🐱', '🐶', '🌈', '🎮',
] as const

function readStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Most-recent-first picks, sanitized (corrupt / foreign values fall away). */
function loadRecent(): string[] {
  const storage = readStorage()
  if (!storage) return []
  try {
    const parsed: unknown = JSON.parse(storage.getItem(QUICK_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    const out: string[] = []
    for (const v of parsed) {
      if (typeof v !== 'string' || v === '' || seen.has(v)) continue
      seen.add(v)
      out.push(v)
      if (out.length >= MAX_RECENT) break
    }
    return out
  } catch {
    return []
  }
}

/**
 * Remember an emoji the player just tapped (quick row, palette, hover bar —
 * every path funnels through the list's onReact, which calls this). The
 * next quick row leads with it; the list is capped so storage stays tiny.
 */
export function recordEmojiUse(emoji: string): void {
  if (!emoji) return
  const next = [emoji, ...loadRecent().filter((e) => e !== emoji)].slice(0, MAX_RECENT)
  try {
    readStorage()?.setItem(QUICK_KEY, JSON.stringify(next))
  } catch {
    // Quota / private mode: habits stay in memory for this session.
  }
}

/**
 * Quick row, most-recent-first over the defaults: the last-tapped emoji
 * leads, then older picks, then the untouched defaults. Never repeats an
 * emoji; `count` is 4 on the hover bar, 6 in desktop menus.
 */
export function getQuickEmojis(count: number): string[] {
  const recent = loadRecent()
  const out = [...recent]
  for (const pool of [QUICK_EMOJIS, REACTION_PALETTE]) {
    for (const emoji of pool) {
      if (out.length >= count) break
      if (!out.includes(emoji)) out.push(emoji)
    }
    if (out.length >= count) break
  }
  return out.slice(0, Math.max(0, count))
}

export function loadRoomReactions(): RoomReactionState {
  const storage = readStorage()
  if (!storage) return {}
  try {
    const raw = storage.getItem(STORE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : {}
    return (parsed ?? {}) as RoomReactionState
  } catch {
    return {}
  }
}

/** Toggle my reaction; returns the next full state (persisted inside). */
export function toggleRoomReaction(
  prev: RoomReactionState,
  messageId: string,
  emoji: string,
): RoomReactionState {
  const current: RoomReactionMap = { ...(prev[messageId] ?? {}) }
  const slot = current[emoji]
  if (slot?.own) {
    const count = slot.count - 1
    if (count <= 0) delete current[emoji]
    else current[emoji] = { count, own: false }
  } else {
    current[emoji] = { count: (slot?.count ?? 0) + 1, own: true }
  }
  const next: RoomReactionState = { ...prev }
  if (Object.keys(current).length === 0) delete next[messageId]
  else next[messageId] = current
  try {
    readStorage()?.setItem(STORE_KEY, JSON.stringify(next))
  } catch {
    // Quota / private mode: reactions stay in memory for this session.
  }
  return next
}
