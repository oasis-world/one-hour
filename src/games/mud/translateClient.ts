// Translation client with local cache (Edge world-mud-translate).
import { getSupabaseClient } from '../../lib/supabaseClient'
import { isSupabaseConfigured } from '../../lib/supabaseConfig'
import { detectInputLang } from '../../lib/detectInputLang'
import type { Lang } from '../../lib/i18n'

export interface TranslateItem { id: string; text: string; from?: string }

const CACHE_PREFIX = 'one-hour:translate:'

function hashKey(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  return `${text.length}-${h.toString(36)}`
}

function readCache(lang: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + lang)
    if (!raw) return {}
    const obj = JSON.parse(raw) as Record<string, string>
    return obj && typeof obj === 'object' ? obj : {}
  } catch { return {} }
}

function writeCache(lang: string, cache: Record<string, string>) {
  try {
    const keys = Object.keys(cache)
    if (keys.length > 300) {
      const trimmed: Record<string, string> = {}
      for (const k of keys.slice(-200)) trimmed[k] = cache[k] as string
      localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(trimmed))
    } else {
      localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(cache))
    }
  } catch { /* quota */ }
}

/** Whether this text is already in the target language (skip Edge call). */
export function isAlreadyInLang(text: string, targetLang: Lang, from?: string): boolean {
  if (!text.trim()) return true
  const hinted = (from ?? '').trim()
  const source = hinted && hinted !== 'auto' ? hinted : null
  if (source) {
    if (source === targetLang) return true
    if (source === 'zh' && targetLang === 'zh') return true
    if (source === 'zh-TW' && targetLang === 'zh-TW') return true
    if (source.startsWith('zh') || targetLang.startsWith('zh')) {
      // simplified vs traditional still needs translation
      return false
    }
    return false
  }
  const detected = detectInputLang(text)
  if (!detected) {
    // Ambiguous ASCII is treated as English (puzzle seeds / AI default).
    return targetLang === 'en'
  }
  if (detected === targetLang) return true
  if ((detected === 'zh' && targetLang === 'zh-TW') || (detected === 'zh-TW' && targetLang === 'zh')) return false
  if (detected.startsWith('zh') !== targetLang.startsWith('zh')) return false
  if (targetLang !== 'en' && detected === 'en') return false
  return false
}

export async function requestTranslateBatch(items: TranslateItem[], targetLang: Lang): Promise<Record<string, string>> {
  const need: TranslateItem[] = []
  const out: Record<string, string> = {}
  const cache = readCache(targetLang)
  for (const it of items) {
    if (!it.text.trim()) { out[it.id] = it.text; continue }
    if (isAlreadyInLang(it.text, targetLang, it.from)) { out[it.id] = it.text; continue }
    const key = hashKey(it.text)
    const cached = cache[key]
    if (cached) { out[it.id] = cached; continue }
    need.push(it)
  }
  if (need.length === 0) return out
  if (!isSupabaseConfigured()) {
    for (const it of need) out[it.id] = it.text
    return out
  }
  try {
    const client = await getSupabaseClient()
    const { data, error } = await client.functions.invoke('world-mud-translate', {
      body: { texts: need.map((n) => ({ id: n.id, text: n.text, from: n.from ?? 'auto' })), targetLang },
    })
    const map = (data?.translations ?? {}) as Record<string, string>
    for (const it of need) {
      const v = typeof map[it.id] === 'string' ? map[it.id] as string : it.text
      out[it.id] = v
      cache[hashKey(it.text)] = v
    }
    writeCache(targetLang, cache)
    void error
  } catch {
    for (const it of need) out[it.id] = it.text
  }
  return out
}
