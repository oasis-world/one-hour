import { useEffect, useState } from 'react'

/**
 * App language (zh / en), persisted and broadcast to React through
 * useLang(). Non-React modules read getLang()/t() at call time; every
 * component under App re-renders on a switch anyway (App uses useLang).
 */

export type Lang =
  | 'zh'
  | 'zh-TW'
  | 'en'
  | 'ja'
  | 'fr'
  | 'es'
  | 'de'
  | 'ko'
  | 'it'
  | 'ar'

const LANG_KEY = 'one-hour-lang'

export const LANGS: Lang[] = ['zh', 'zh-TW', 'en', 'ja', 'fr', 'es', 'de', 'ko', 'it', 'ar']

function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as string[]).includes(v)
}

function detect(): Lang {
  try {
    const saved = globalThis.localStorage?.getItem(LANG_KEY)
    if (isLang(saved)) return saved
  } catch {
    // Private mode: fall through to the browser language.
  }
  try {
    const nav = globalThis.navigator?.language?.toLowerCase() ?? ''
    if (nav.startsWith('zh-tw') || nav.startsWith('zh-hk') || nav.startsWith('zh-mo')) return 'zh-TW'
    if (nav.startsWith('zh')) return 'zh'
    if (nav.startsWith('ja')) return 'ja'
    if (nav.startsWith('fr')) return 'fr'
    if (nav.startsWith('es')) return 'es'
    if (nav.startsWith('de')) return 'de'
    if (nav.startsWith('ko')) return 'ko'
    if (nav.startsWith('it')) return 'it'
    if (nav.startsWith('ar')) return 'ar'
    return 'en'
  } catch {
    return 'en'
  }
}

let current: Lang = detect()
const listeners = new Set<(lang: Lang) => void>()

export function getLang(): Lang {
  return current
}

export function setLang(lang: Lang): void {
  current = lang
  try {
    globalThis.localStorage?.setItem(LANG_KEY, lang)
  } catch {
    // Private mode: language lives for this session only.
  }
  for (const fn of listeners) fn(lang)
}

export function subscribeLang(fn: (lang: Lang) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useLang(): Lang {
  const [lang, setLangState] = useState<Lang>(current)
  useEffect(() => subscribeLang(setLangState), [])
  return lang
}

export const COMPOSER_PLACEHOLDER: Record<Lang, string> = {
  zh: '说点什么…',
  'zh-TW': '說點什麼…',
  en: 'Say something…',
  ja: '何か言って…',
  fr: 'Dites quelque chose…',
  es: 'Di algo…',
  de: 'Sag etwas…',
  ko: '무언가 말해봐…',
  it: 'Dì qualcosa…',
  ar: 'قل شيئاً…',
}

export const LANG_LABELS: Record<Lang, string> = {
  zh: '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語',
  fr: 'Français',
  es: 'Español',
  de: 'Deutsch',
  ko: '한국어',
  it: 'Italiano',
  ar: 'العربية',
}

import { TRANSLATIONS } from './translations'

/** Inline translation: t('中文', 'English'). */
export function t(zh: string, en: string): string {
  if (current === 'zh') return zh
  if (current === 'zh-TW') return TRANSLATIONS['zh-TW']?.[en] ?? zh
  return TRANSLATIONS[current]?.[en] ?? en
}
