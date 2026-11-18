export const NEWS_BOT_ID = '00000000-0000-0000-0000-000000000001'
export const NEWS_PREFIX = 'NEWS:'

export const NEWS_LOCALES = [
  { lang: 'zh', hl: 'zh-CN', gl: 'CN', ceid: 'CN:zh-Hans', name: '中文新闻伙伴' },
  { lang: 'zh-TW', hl: 'zh-TW', gl: 'TW', ceid: 'TW:zh-Hant', name: '繁體中文新聞夥伴' },
  { lang: 'en', hl: 'en-US', gl: 'US', ceid: 'US:en', name: 'News Companion' },
  { lang: 'ja', hl: 'ja', gl: 'JP', ceid: 'JP:ja', name: 'ニュースパートナー' },
  { lang: 'fr', hl: 'fr', gl: 'FR', ceid: 'FR:fr', name: 'Compagnon actualités' },
  { lang: 'es', hl: 'es', gl: 'ES', ceid: 'ES:es', name: 'Compañero de noticias' },
  { lang: 'de', hl: 'de', gl: 'DE', ceid: 'DE:de', name: 'News-Begleiter' },
  { lang: 'ko', hl: 'ko', gl: 'KR', ceid: 'KR:ko', name: '뉴스 파트너' },
  { lang: 'it', hl: 'it', gl: 'IT', ceid: 'IT:it', name: 'Compagno di notizie' },
  { lang: 'ar', hl: 'ar', gl: 'EG', ceid: 'EG:ar', name: 'رفيق الأخبار' },
] as const

export type NewsLocale = typeof NEWS_LOCALES[number]

export interface NewsSourceArticle {
  lang: NewsLocale['lang']
  title: string
  description: string
  url: string
  source: string
  publishedAt: string
}

export interface NewsCardData {
  title: string
  summary: string
  url: string
  source: string
  publishedAt: string
}

export async function fetchLatestNews(locale: NewsLocale): Promise<NewsSourceArticle[]> {
  const feedUrl = new URL('https://news.google.com/rss')
  feedUrl.search = new URLSearchParams({ hl: locale.hl, gl: locale.gl, ceid: locale.ceid }).toString()
  const response = await fetch(feedUrl, {
    headers: { 'user-agent': 'OneHourCompanionNews/1.0', accept: 'application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(9000),
  })
  if (!response.ok) throw new Error(`Google News RSS returned ${response.status}`)
  const xml = await response.text()
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)]
    .map((match) => {
      const item = match[1]
      const title = readTag(item, 'title')
      const rawUrl = readTag(item, 'link')
      const url = safeHttpUrl(rawUrl)
      if (!title || !url) return null
      return {
        lang: locale.lang,
        title: cleanText(title).slice(0, 180),
        description: cleanText(readTag(item, 'description')).slice(0, 600),
        url,
        source: cleanText(readTag(item, 'source')).slice(0, 80),
        publishedAt: validDate(readTag(item, 'pubDate')),
      }
    })
    .filter((item): item is NewsSourceArticle => item !== null)
    .slice(0, 30)
}

export function readNewsCard(content: string): { lang: string; url: string } | null {
  if (!content.startsWith(NEWS_PREFIX)) return null
  const separator = content.indexOf(':', NEWS_PREFIX.length)
  if (separator < 0) return null
  try {
    const data = JSON.parse(content.slice(separator + 1)) as { url?: unknown }
    return typeof data.url === 'string' ? { lang: content.slice(NEWS_PREFIX.length, separator), url: data.url } : null
  } catch {
    return null
  }
}

export function makeNewsContent(lang: string, data: NewsCardData): string {
  const compact = { title: data.title.slice(0, 150), summary: data.summary.slice(0, 260), url: data.url, source: data.source.slice(0, 80), publishedAt: data.publishedAt }
  let content = `${NEWS_PREFIX}${lang}:${JSON.stringify(compact)}`
  while (content.length > 1000 && compact.summary.length > 80) {
    compact.summary = compact.summary.slice(0, compact.summary.length - 40)
    content = `${NEWS_PREFIX}${lang}:${JSON.stringify(compact)}`
  }
  return content
}

function readTag(xml: string, name: string): string {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))
  return match?.[1] ?? ''
}

function cleanText(value: string): string {
  const decoded = decodeXml(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))
    .replace(/<[^>]*>/g, ' ')
  return decodeXml(decoded)
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeXml(value: string): string {
  return value.replace(/&#(x[0-9a-f]+|\d+);|&quot;|&apos;|&lt;|&gt;|&nbsp;|&amp;/gi, (entity, code: string | undefined) => {
    if (code) {
      const point = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : parseInt(code, 10)
      return Number.isFinite(point) && point >= 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point)
        : ''
    }
    return ({ '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&amp;': '&' } as Record<string, string>)[entity.toLowerCase()] ?? entity
  })
}

function safeHttpUrl(value: string): string {
  try {
    const url = new URL(cleanText(value))
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''
  } catch {
    return ''
  }
}

function validDate(value: string): string {
  const date = new Date(cleanText(value))
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString()
}
