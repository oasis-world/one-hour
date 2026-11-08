// Locale-aware rendering for shared-world content.
// DB stores bilingual seeds as `zh\n---\nen` and zh-only titles.
// Each UI language must see only its own side — never a mixed blob.
import type { Lang } from '../../lib/i18n'
import { PUZZLE_SEEDS, type PuzzleRow, type WorldLogRow, type PlayerTaskRow, type WorldEventRow } from './openWorldTypes'
import { detectInputLang } from '../../lib/detectInputLang'

export type LangFamily = 'zh' | 'en'

export function langFamily(lang: string): LangFamily {
  return lang.startsWith('zh') ? 'zh' : 'en'
}

function splitPair(s: string, sep: string): { zh: string; en: string } {
  const i = s.indexOf(sep)
  if (i === -1) return { zh: s, en: s }
  return { zh: s.slice(0, i), en: s.slice(i + sep.length) }
}

export function puzzleTitle(p: PuzzleRow, lang: Lang): string {
  const seed = PUZZLE_SEEDS.find((s) => s.id === p.id)
  if (seed) return langFamily(lang) === 'zh' ? seed.titleZh : seed.titleEn
  return p.title
}

export function puzzleRiddle(p: PuzzleRow, lang: Lang): string {
  const seed = PUZZLE_SEEDS.find((s) => s.id === p.id)
  if (seed) return langFamily(lang) === 'zh' ? seed.riddleZh : seed.riddleEn
  const pair = splitPair(p.riddle ?? '', '\n---\n')
  return langFamily(lang) === 'zh' ? pair.zh : pair.en
}

export function puzzleHint(p: PuzzleRow, lang: Lang): string | null {
  const seed = PUZZLE_SEEDS.find((s) => s.id === p.id)
  if (seed) return langFamily(lang) === 'zh' ? seed.hintZh : seed.hintEn
  if (!p.hint) return null
  const pair = splitPair(p.hint, ' / ')
  return langFamily(lang) === 'zh' ? pair.zh : pair.en
}

const PHASE_NAMES: Record<Lang, string> = {
  zh: '启元期', 'zh-TW': '啟元期', en: 'Genesis Phase', ja: '啓元フェーズ', fr: 'Phase de Genèse', es: 'Fase Génesis', de: 'Genesis-Phase', ko: '기원기', it: 'Fase Genesi', ar: 'مرحلة التكوين',
}

export function phaseOf(stored: string, lang: Lang): string {
  if (stored === '启元期' || stored === 'Genesis Phase' || stored === '啟元期') return PHASE_NAMES[lang] ?? PHASE_NAMES.en
  return stored
}

const SEED_EVENT_LOCALE: Record<Lang, { title: string; desc: string }> = {
  zh: { title: '潮汐初醒', desc: '八域封印松动，潮汐使徒们踏入世界共同开凿封印。' },
  'zh-TW': { title: '潮汐初醒', desc: '八域封印鬆動，潮汐使徒們踏入世界共同開鑿封印。' },
  en: { title: 'Tide Awakening', desc: 'The eight regions loosen their seals. Tide Apostles enter the world together to break them.' },
  ja: { title: '潮の目覚め', desc: '八域の封印が緩み、潮の使徒たちが共に封印を開く。' },
  fr: { title: 'Éveil de la Marée', desc: 'Les huit régions desserrent leurs sceaux. Les apôtres entrent ensemble dans le monde.' },
  es: { title: 'Despertar de la Marea', desc: 'Las ocho regiones aflojan sus sellos. Los apóstoles entran juntos al mundo.' },
  de: { title: 'Erwachen der Gezeiten', desc: 'Die acht Regionen lockern ihre Siegel. Apostel betreten gemeinsam die Welt.' },
  ko: { title: '조수의 깨어남', desc: '팔개 영역의 봉인이 풀리고 조수의 사도들이 함께 세계에 들어갑니다.' },
  it: { title: 'Risveglio della Marea', desc: 'Le otto regioni allentano i sigilli. Gli apostoli entrano insieme nel mondo.' },
  ar: { title: 'استيقاظ المد', desc: 'المناطق الثماني ترخي أختامها. يدخل الرسل العالم معاً.' },
}

export function eventText(ev: WorldEventRow, lang: Lang): { title: string; desc: string } {
  if (ev.title === '潮汐初醒') return SEED_EVENT_LOCALE[lang] ?? SEED_EVENT_LOCALE.en
  return { title: ev.title, desc: ev.description }
}

export function logVisible(row: WorldLogRow, lang: Lang): boolean {
  return langFamily(row.lang || 'zh') === langFamily(lang)
}

export function taskVisible(task: PlayerTaskRow, lang: Lang): boolean {
  const detected = detectInputLang(`${task.prompt} ${task.ai_title} ${task.ai_desc}`)
  const fam = detected ? langFamily(detected) : 'en'
  return fam === langFamily(lang)
}
