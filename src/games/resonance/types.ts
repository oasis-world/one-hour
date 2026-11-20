/** Domain types + timing constants for the "同频 / Resonance" social game. */
import type { Localized } from './localized'

export interface ResonanceOption {
  id: string
  emoji: string
  label: Localized
}

export interface ResonanceQuestion {
  id: string
  prompt: Localized
  options: ResonanceOption[]
}

/** One card = one row. Questions are generated once and reused across rounds. */
export interface ResonanceRoundRow {
  instanceId: string
  questions: ResonanceQuestion[]
  createdAt: number // epoch ms (from DB created_at)
  expiresAt: number
}

export interface ResonanceVote {
  instanceId: string
  round: number
  userId: string
  optionId: string
  displayName: string
  avatarStyle: string
  avatarSeed: string
  avatarUrl: string | null
  createdAt: number
}

export const RESONANCE_ROUND_MS = 2 * 60 * 1000 // 2 minutes of voting per question
export const RESONANCE_REVEAL_MS = 20_000 // 20 seconds of results
export const RESONANCE_CYCLE_MS = RESONANCE_ROUND_MS + RESONANCE_REVEAL_MS
export const RESONANCE_PARTICIPATION_POINTS = 2
export const RESONANCE_MAX_QUESTIONS = 5

export type PhaseKind = 'voting' | 'reveal'

export interface ResonancePhase {
  round: number
  kind: PhaseKind
  endsAt: number
}
