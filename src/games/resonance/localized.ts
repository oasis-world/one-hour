import type { Lang } from '../../lib/i18n'

/** A string translated into some or all of the 10 supported languages. */
export type Localized = Partial<Record<Lang, string>>

export const RES_LANGS: Lang[] = ['zh', 'zh-TW', 'en', 'ja', 'fr', 'es', 'de', 'ko', 'it', 'ar']

/** Compact builder for a complete 10-language string. */
export function L(zh: string, zhTW: string, en: string, ja: string, fr: string, es: string, de: string, ko: string, it: string, ar: string): Localized {
  return { zh, 'zh-TW': zhTW, en, ja, fr, es, de, ko, it, ar }
}

/** Pick the viewer's language, falling back to en → zh → any available value. */
export function pickLocalized(value: Localized | undefined, lang: Lang): string {
  if (!value) return ''
  const direct = value[lang]
  if (direct) return direct
  if (value.en) return value.en
  if (value.zh) return value.zh
  for (const code of RES_LANGS) {
    const found = value[code]
    if (found) return found
  }
  return ''
}

/** Accept a raw map from the AI (or the legacy zh/en shape) and normalize it. */
export function toLocalized(raw: unknown): Localized | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Localized = {}
    for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof val === 'string' && val.trim()) (out as Record<string, string>)[key] = val
    }
    return Object.keys(out).length ? out : null
  }
  return null
}
