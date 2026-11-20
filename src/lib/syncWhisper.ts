import { LANGS, type Lang } from './i18n'
import { hourRoleAuthor } from './hourRole'
import { sendGameWhisper } from './gameNotice'

/**
 * Private "you are in sync with X" whispers sent by the hour-duty role after a
 * resonance reveal. The content embeds only IDs + a compact partner snapshot
 * (kept well under the DB's 1000-char limit). The recipient's client fetches
 * the localized question/option from resonance_rounds and renders avatar chips
 * that open the author popover. No DB schema change needed.
 */

export const SYNC_WHISPER_MARKER = 'SYNCWHISPER:'

export interface SyncPartner {
  userId: string
  name: string
  style: string
  seed: string
  url: string | null
  lang?: string | null
}

export interface SyncWhisperPayload {
  iid: string // resonance instanceId (to fetch localized question)
  round: number
  optionId: string
  emoji: string
  partners: SyncPartner[]
}

export function buildSyncWhisperContent(payload: SyncWhisperPayload): string {
  return `${SYNC_WHISPER_MARKER}${JSON.stringify(payload)}`
}

export function parseSyncWhisper(content: string): SyncWhisperPayload | null {
  const idx = content.indexOf(SYNC_WHISPER_MARKER)
  if (idx < 0) return null
  const raw = content.slice(idx + SYNC_WHISPER_MARKER.length).trim()
  try {
    const obj = JSON.parse(raw) as SyncWhisperPayload
    if (!obj.iid || typeof obj.round !== 'number' || !obj.optionId || !Array.isArray(obj.partners)) return null
    return obj
  } catch {
    return null
  }
}

export function isSyncWhisper(content: string): boolean {
  return content.includes(SYNC_WHISPER_MARKER)
}

export type SyncMember = SyncPartner

/** Send one private whisper per member; each lists the OTHER members as chips. */
export function sendSyncWhispers(args: {
  instanceId: string
  emoji: string
  round: number
  optionId: string
  group: SyncMember[]
  expiresAt: number
  lang: Lang
}): void {
  for (const recipient of args.group) {
    // Keep payload under the 1000-char DB content limit.
    const others = args.group.filter((m) => m.userId !== recipient.userId).slice(0, 6)
    if (others.length === 0) continue
    const payload: SyncWhisperPayload = {
      iid: args.instanceId, round: args.round, optionId: args.optionId,
      emoji: args.emoji, partners: others,
    }
    // Localize the duty-persona name/role to THIS recipient's language.
    const recipientLang = LANGS.includes(recipient.lang as Lang)
      ? recipient.lang as Lang
      : args.lang
    sendGameWhisper(
      buildSyncWhisperContent(payload),
      args.expiresAt,
      recipient.userId,
      recipient.name,
      hourRoleAuthor(recipientLang),
    )
  }
}
