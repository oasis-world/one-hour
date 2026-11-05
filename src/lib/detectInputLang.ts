import type { Lang } from './i18n'

const TRAD_MARKERS = /[裡裏後國學時會發長門問書萬與業體來還進過道達運選遺醫臺廣廠灣據動務獨獲價內舊據舉讓邊變標關聯觀觀]/

function isArabic(s: string): boolean { return /[\u0600-\u06FF]/.test(s) }
function isHangul(s: string): boolean { return /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(s) }
function isKana(s: string): boolean { return /[\u3040-\u30FF]/.test(s) }
function isHan(s: string): boolean { return /[\u4E00-\u9FFF]/.test(s) }

// Very small keyword hints for Latin languages — enough for short MUD inputs
const LATIN_HINTS: Array<{ lang: Lang; re: RegExp }> = [
  { lang: 'fr', re: /\b(bonjour|salut|merci|vous|je\s|nous|avec|où|très|être|parler|regarder|aller|chercher)\b/i },
  { lang: 'es', re: /\b(hola|gracias|por\s+favor|usted|vosotros|con|hablar|mirar|buscar|ir\s+a|donde)\b/i },
  { lang: 'de', re: /\b(hallo|danke|bitte|ich\s+bin|du\s+bist|mit|sprechen|schauen|suchen|gehen|wo)\b/i },
  { lang: 'it', re: /\b(ciao|grazie|per\s+favore|io\s+sono|con|parlare|guardare|cercare|andare|dove)\b/i },
  { lang: 'ko', re: /\b(안녕|감사|여기|저기|가다|보다|말하다|찾다)\b/ },
  { lang: 'ja', re: /\b(こんにちは|ありがとう|すみません|見る|話す|探す|行く)\b/ },
  { lang: 'ar', re: /[\u0600-\u06FF]/ },
]

/**
 * Detect the language of freeform user input for MUD.
 * Returns a Lang if confident, otherwise null (caller falls back to UI lang).
 * - CJK/Arabic/Hangul/Kana are decisive
 * - Latin script falls back to keyword hints, otherwise null
 */
export function detectInputLang(text: string): Lang | null {
  const s = text.trim()
  if (!s) return null
  if (isArabic(s)) return 'ar'
  if (isHangul(s)) return 'ko'
  if (isKana(s)) return 'ja'
  if (isHan(s)) {
    // Traditional vs Simplified: use marker chars; fallback to zh
    return TRAD_MARKERS.test(s) ? 'zh-TW' : 'zh'
  }
  // Latin script: try keyword hints
  for (const { lang, re } of LATIN_HINTS) {
    if (re.test(s)) return lang
  }
  // Accent-based hints
  if (/[àâäéèêëîïôöùûüÿçæœ]/i.test(s)) {
    // French vs Italian both use accents — check French-specific vs Italian
    // If we already matched hints above, we would have returned; here default to fr for safety
    return 'fr'
  }
  if (/[ñ¿¡áéíóú]/i.test(s) && /hola|gracias|hablar|buscar/i.test(s)) return 'es'
  if (/[äöüß]/i.test(s)) return 'de'
  if (/[àèéìòù]/i.test(s)) return 'it'
  // Pure ASCII/Latin without distinctive marks — ambiguous, let caller use UI lang
  return null
}

/** Known button/choice actions that should always use UI language, not input detection */
const KNOWN_COMMANDS = new Set([
  'look', 'l', 'talk', 'search', 'inventory', 'inv', 'help',
  'go north', 'go south', 'go east', 'go west',
  'go_north', 'go_south', 'go_east', 'go_west',
  'north', 'south', 'east', 'west',
  'n', 's', 'e', 'w',
  '看看', '观察', '北', '南', '东', '西',
])

export function isKnownCommand(raw: string): boolean {
  const t = raw.trim().toLowerCase()
  return KNOWN_COMMANDS.has(t)
}
