import { useEffect, useState } from 'react'

/**
 * App language (zh / en), persisted and broadcast to React through
 * useLang(). Non-React modules read getLang()/t() at call time; every
 * component under App re-renders on a switch anyway (App uses useLang).
 */

export type Lang = 'zh' | 'en'

const LANG_KEY = 'one-hour-lang'

function detect(): Lang {
  try {
    const saved = globalThis.localStorage?.getItem(LANG_KEY)
    if (saved === 'zh' || saved === 'en') return saved
  } catch {
    // Private mode: fall through to the browser language.
  }
  try {
    return globalThis.navigator?.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  } catch {
    return 'zh'
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

/** Inline translation: t('中文', 'English'). */
export function t(zh: string, en: string): string {
  return current === 'zh' ? zh : en
}
