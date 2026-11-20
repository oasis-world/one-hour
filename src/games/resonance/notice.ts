import { type Lang } from '../../lib/i18n'
import type { PresenceMember } from '../../lib/chatTypes'
import { sendSysNotice } from '../../lib/sysNotice'
import { sendSyncWhispers, type SyncMember } from '../../lib/syncWhisper'
import { questionText, optionText } from './resonanceText'
import type { ResonanceQuestion, ResonanceVote } from './types'
import type { Tally } from './logic'

const isZh = (lang: Lang) => lang === 'zh' || lang === 'zh-TW'

export interface RevealData {
  round: number
  question: ResonanceQuestion
  optionId: string
  matches: ResonanceVote[]
  total: number
}

/** Plain-text result body for one language. No icons — the header carries the badge. */
function buildResonanceNotice(args: RevealData, lang: Lang): string {
  const q = questionText(lang, args.question.prompt)
  const option = args.question.options.find((o) => o.id === args.optionId)
  const label = option ? optionText(lang, option.label) : args.optionId

  if (args.matches.length === 0) {
    return isZh(lang)
      ? `同频 · 第 ${args.round + 1} 轮「${q}」揭晓：这轮没人选一样的答案，下轮见！`
      : `In sync · Round ${args.round + 1} "${q}": nobody matched this time. Next one!`
  }

  const names = args.matches.slice(0, 4).map((m) => `@${m.displayName}`).join(' ')
  const more = args.matches.length > 4 ? ` +${args.matches.length - 4}` : ''
  if (isZh(lang)) {
    return `同频 · 第 ${args.round + 1} 轮「${q}」揭晓：${names}${more} 都选了「${label}」（${args.matches.length}/${args.total} 人）`
  }
  return `In sync · Round ${args.round + 1} "${q}": ${names}${more} all picked "${label}" (${args.matches.length}/${args.total})`
}

/**
 * Decide whether this round produced a "同频" (an option with 2+ votes) and,
 * if so, publish one localized notice per language under the hourly role.
 * Returns true when a notice was posted.
 */
export function maybePostRevealNotice(args: {
  instanceId: string
  round: number
  question: ResonanceQuestion
  tally: Tally
  selfId: string
  onlineMembers: PresenceMember[]
  expiresAt: number
  lang: Lang
}): boolean {
  const { tally } = args
  const syncOption = Object.entries(tally.counts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])[0]
  if (!syncOption) return false
  const group = (tally.votersByOption[syncOption[0]] ?? []).slice()
    .sort((a, b) => a.userId.localeCompare(b.userId))
  if (!group[0] || group[0].userId !== args.selfId) return false

  const data: RevealData = { round: args.round, question: args.question, optionId: syncOption[0], matches: group, total: tally.total }
  // 1) Public result — one localized copy per language, visible to all.
  sendSysNotice((lang) => buildResonanceNotice(data, lang), args.expiresAt)
  // 2) Private whispers — each member learns who else they synced with.
  const option = args.question.options.find((o) => o.id === syncOption[0])
  const memberById = new Map(args.onlineMembers.map((m) => [m.userId, m]))
  const members: SyncMember[] = group.map((v) => {
    const presence = memberById.get(v.userId)
    return {
      userId: v.userId,
      name: presence?.displayName || v.displayName,
      style: presence?.avatarStyle || v.avatarStyle,
      seed: presence?.avatarSeed || v.avatarSeed,
      url: presence?.avatarUrl ?? v.avatarUrl,
      lang: presence?.lang ?? null,
    }
  })
  sendSyncWhispers({
    instanceId: args.instanceId,
    emoji: option?.emoji ?? '✦',
    round: args.round,
    optionId: syncOption[0],
    group: members,
    expiresAt: args.expiresAt,
    lang: args.lang,
  })
  return true
}
