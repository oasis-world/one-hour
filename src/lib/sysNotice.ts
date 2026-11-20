import { LANGS, type Lang } from './i18n'
import { hourRoleAuthor } from './hourRole'
import { sendGameNotice } from './gameNotice'
import type { ChatAuthorOverride } from './chatTypes'

/**
 * System notices (resonance / jackpot) are published once per language and
 * each client shows only its own — the same pattern as NEWS cards. This keeps
 * message content under the 1000-char DB limit while making the body text,
 * the duty-person name and the role label all follow the VIEWER's language
 * (they are baked into each localized copy at send time).
 */

export const SYS_NOTICE_PREFIX = 'SYS:'

export function buildSysNoticeContent(lang: Lang, text: string): string {
  return `${SYS_NOTICE_PREFIX}${lang}:${text}`
}

/** Extract the language tag from a localized system notice, if any. */
export function sysNoticeLang(content: string): Lang | null {
  if (!content.startsWith(SYS_NOTICE_PREFIX)) return null
  const sep = content.indexOf(':', SYS_NOTICE_PREFIX.length)
  if (sep < 0) return null
  const lang = content.slice(SYS_NOTICE_PREFIX.length, sep)
  return (LANGS as string[]).includes(lang) ? lang as Lang : null
}

/** True when this localized message is not for the viewer's language. */
export function isForeignSysNotice(entry: { content: string }, lang?: string | null): boolean {
  const noticeLang = sysNoticeLang(entry.content)
  return noticeLang !== null && noticeLang !== (lang ?? 'zh')
}

/** Strip the language marker so only the localized body renders. */
export function sysNoticeBody(content: string): string | null {
  const lang = sysNoticeLang(content)
  if (!lang) return null
  const sep = content.indexOf(':', SYS_NOTICE_PREFIX.length)
  return content.slice(sep + 1)
}

/** Publish one copy per language, each presented as the current hour's role. */
export function sendSysNotice(textFor: (lang: Lang) => string, expiresAt: number): void {
  for (const lang of LANGS) {
    const override: ChatAuthorOverride = hourRoleAuthor(lang)
    sendGameNotice(buildSysNoticeContent(lang, textFor(lang)), expiresAt, override)
  }
}
