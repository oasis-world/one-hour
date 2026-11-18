import type { Lang } from './i18n'

export const NEWS_CARD_PREFIX = 'NEWS:'
export const NEWS_BOT_USER_ID = '00000000-0000-0000-0000-000000000001'

export interface CompanionNewsCardData {
  lang: Lang
  title: string
  summary: string
  url: string
  source: string
  publishedAt: string
}

export function parseCompanionNewsCard(content: string, userId: string): CompanionNewsCardData | null {
  if (userId !== NEWS_BOT_USER_ID || !content.startsWith(NEWS_CARD_PREFIX)) return null
  const separator = content.indexOf(':', NEWS_CARD_PREFIX.length)
  if (separator < 0) return null
  const lang = content.slice(NEWS_CARD_PREFIX.length, separator) as Lang
  if (!['zh', 'zh-TW', 'en', 'ja', 'fr', 'es', 'de', 'ko', 'it', 'ar'].includes(lang)) return null
  try {
    const data = JSON.parse(content.slice(separator + 1)) as Partial<CompanionNewsCardData>
    const url = new URL(data.url ?? '')
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (
      typeof data.title !== 'string' || !data.title ||
      typeof data.summary !== 'string' || !data.summary ||
      typeof data.source !== 'string' ||
      typeof data.publishedAt !== 'string'
    ) return null
    return { lang, title: data.title, summary: data.summary, url: url.href, source: data.source, publishedAt: data.publishedAt }
  } catch {
    return null
  }
}
