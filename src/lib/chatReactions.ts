/**
 * Emoji reactions for the global room. Reaction rows are synchronized by
 * Supabase Realtime; only the player's quick-emoji preference stays local.
 */

export type RoomReactionMap = Record<string, { count: number; own: boolean }>

export type RoomReactionState = Record<string, RoomReactionMap>

export interface RoomReactionRecord {
  messageId: string
  userId: string
  emoji: string
}

export interface RoomReactionChange extends RoomReactionRecord {
  active: boolean
}

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

export function applyRoomReactionChange(
  records: RoomReactionRecord[],
  change: RoomReactionChange,
): RoomReactionRecord[] {
  const index = records.findIndex((row) => sameReaction(row, change))
  if (change.active) {
    return index >= 0 ? records : [...records, change]
  }
  return index < 0 ? records : records.filter((_, i) => i !== index)
}

export function summarizeRoomReactions(
  records: RoomReactionRecord[],
  selfId: string | null,
): RoomReactionState {
  const state: RoomReactionState = {}
  for (const row of records) {
    const message = (state[row.messageId] ??= {})
    const summary = (message[row.emoji] ??= { count: 0, own: false })
    summary.count += 1
    if (row.userId === selfId) summary.own = true
  }
  return state
}

function sameReaction(a: RoomReactionRecord, b: RoomReactionRecord): boolean {
  return a.messageId === b.messageId && a.userId === b.userId && a.emoji === b.emoji
}
