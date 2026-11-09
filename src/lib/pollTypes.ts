/**
 * Poll domain types + chat-message marker helpers.
 * Kept free of React and the vendor SDK so the modal, the card and the
 * remote layer share one validation / tally source of truth.
 */

export interface PollData {
  pollId: string
  userId: string
  question: string
  options: string[]
  /** True when voters may pick more than one option. */
  multiple: boolean
  closedAt: string | null
  createdAt: string
  expiresAt: string
}

export interface PollVoteRow {
  pollId: string
  userId: string
  optionIndex: number
  displayName: string | null
}

export const POLL_MARKER = '__POLL__:'
export const POLL_QUESTION_MAX = 120
export const POLL_OPTION_MAX = 40
export const POLL_MIN_OPTIONS = 2
export const POLL_MAX_OPTIONS = 8
export const POLL_TTL_MS = 60 * 60 * 1000

/** Draft produced by the create-poll window. */
export interface PollDraft {
  question: string
  options: string[]
  multiple: boolean
  durationId: PollDurationId
}

export type PollDurationId = '10m' | '30m' | '1h'

export const POLL_DURATIONS: Array<{ id: PollDurationId; minutes: number; labelZh: string; labelEn: string }> = [
  { id: '10m', minutes: 10, labelZh: '10 分钟', labelEn: '10 min' },
  { id: '30m', minutes: 30, labelZh: '30 分钟', labelEn: '30 min' },
  { id: '1h', minutes: 60, labelZh: '1 小时', labelEn: '1 hour' },
]

export function durationMinutes(id: PollDurationId): number {
  return POLL_DURATIONS.find((d) => d.id === id)?.minutes ?? 60
}

/** Parsed from a chat message body: `__POLL__:<pollId>`. */
export function parsePollRef(content: string): { pollId: string } | null {
  const idx = content.indexOf(POLL_MARKER)
  if (idx === -1) return null
  const rest = content.slice(idx + POLL_MARKER.length).trim()
  const pollId = rest.split(/\s/)[0]?.trim()
  if (!pollId) return null
  return { pollId }
}

export function buildPollContent(question: string, pollId: string): string {
  return `🗳️ ${question}\n${POLL_MARKER}${pollId}`
}

export function newPollId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `poll-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export interface PollValidationError { zh: string; en: string }

export function validatePollDraft(question: string, options: string[]): PollValidationError | null {
  if (!question.trim()) {
    return { zh: '先写下问题，再发起投票', en: 'Write a question first' }
  }
  const filled = options.map((o) => o.trim()).filter(Boolean)
  if (filled.length < POLL_MIN_OPTIONS) {
    return { zh: '至少需要 2 个选项', en: 'At least 2 options are required' }
  }
  const seen = new Set<string>()
  for (const opt of filled) {
    if (seen.has(opt)) return { zh: '选项不能重复', en: 'Options must be unique' }
    seen.add(opt)
  }
  return null
}

export interface PollTallies {
  counts: number[]
  totalVotes: number
  /** Distinct voters (one person may vote twice in a multi-pick poll). */
  voterCount: number
  votersByOption: Map<number, PollVoteRow[]>
}

export function computePollTallies(poll: PollData, votes: PollVoteRow[]): PollTallies {
  const counts = poll.options.map(() => 0)
  const votersByOption = new Map<number, PollVoteRow[]>()
  const voterIds = new Set<string>()
  for (const vote of votes) {
    if (vote.optionIndex < 0 || vote.optionIndex >= counts.length) continue
    counts[vote.optionIndex] += 1
    voterIds.add(vote.userId)
    const list = votersByOption.get(vote.optionIndex) ?? []
    list.push(vote)
    votersByOption.set(vote.optionIndex, list)
  }
  const totalVotes = counts.reduce((sum, n) => sum + n, 0)
  return { counts, totalVotes, voterCount: voterIds.size, votersByOption }
}

/** Whether this poll still accepts votes at the given moment. */
export function isPollOpen(poll: PollData, now = Date.now()): boolean {
  if (poll.closedAt) return false
  const expires = new Date(poll.expiresAt).getTime()
  return Number.isFinite(expires) ? now < expires : true
}

export function pollRemainingMs(poll: PollData, now = Date.now()): number {
  const expires = new Date(poll.expiresAt).getTime()
  return Math.max(0, expires - now)
}

/** mm:ss countdown for the poll footer (durations are ≤ 1 hour). */
export function formatPollRemaining(ms: number): string {
  const totalSec = Math.ceil(ms / 1000)
  const mm = Math.floor(totalSec / 60)
  const ss = totalSec % 60
  return `${mm}:${String(ss).padStart(2, '0')}`
}
