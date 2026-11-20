import {
  RESONANCE_CYCLE_MS,
  RESONANCE_REVEAL_MS,
  RESONANCE_ROUND_MS,
  type ResonancePhase,
  type ResonanceQuestion,
  type ResonanceVote,
} from './types'

/** Which question + phase is live right now, derived purely from card creation time. */
export function currentPhase(createdAt: number, now = Date.now()): ResonancePhase {
  const elapsed = Math.max(0, now - createdAt)
  const round = Math.floor(elapsed / RESONANCE_CYCLE_MS)
  const inRound = elapsed % RESONANCE_CYCLE_MS
  const voting = inRound < RESONANCE_ROUND_MS
  return {
    round,
    kind: voting ? 'voting' : 'reveal',
    endsAt: createdAt + round * RESONANCE_CYCLE_MS + (voting ? RESONANCE_ROUND_MS : RESONANCE_CYCLE_MS),
  }
}

/** Questions repeat cyclically so a 1-hour card never runs dry. */
export function questionFor(questions: ResonanceQuestion[], round: number): ResonanceQuestion | null {
  if (questions.length === 0) return null
  return questions[round % questions.length] ?? null
}

export interface Tally {
  counts: Record<string, number>
  votersByOption: Record<string, ResonanceVote[]>
  total: number
}

export function tallyVotes(votes: ResonanceVote[], round: number): Tally {
  const counts: Record<string, number> = {}
  const votersByOption: Record<string, ResonanceVote[]> = {}
  const seen = new Set<string>()
  let total = 0
  for (const vote of votes) {
    if (vote.round !== round) continue
    // One person = one vote per round (defensive; DB PK also enforces this).
    if (seen.has(vote.userId)) continue
    seen.add(vote.userId)
    counts[vote.optionId] = (counts[vote.optionId] ?? 0) + 1
    ;(votersByOption[vote.optionId] ??= []).push(vote)
    total += 1
  }
  return { counts, votersByOption, total }
}

/** Players who picked the same option as me, excluding myself. */
export function resonantWith(votes: ResonanceVote[], round: number, myUserId: string, myOptionId: string | null): ResonanceVote[] {
  if (!myOptionId) return []
  return votes.filter((v) => v.round === round && v.userId !== myUserId && v.optionId === myOptionId)
}

export function formatRemaining(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** ms until the next phase starts (used to schedule local reward/notice). */
export function msUntilPhase(phase: ResonancePhase, now = Date.now()): number {
  return Math.max(0, phase.endsAt - now)
}

export const REVEAL_DURATION_MS = RESONANCE_REVEAL_MS
