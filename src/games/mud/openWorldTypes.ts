// Open-world MUD domain types — Tide Genesis (潮汐启元).
// Normalized tables replace the old single-row world_mud_state JSONB.
import type { Lang } from '../../lib/i18n'

export interface WorldRow {
  id: string
  phase: string
  epoch: number
  solved_puzzles: number
  total_puzzles: number
  updated_at: string
}

export interface RegionRow {
  id: string
  world_id: string
  display_order: number
  unlocked: boolean
}

export interface RoomRow {
  id: string
  region_id: string
  world_id: string
  name_zh: string | null
  name_en: string | null
  exits: Record<string, string>
  danger: number
  richness: number
  is_hidden: boolean
}

export interface ItemRow {
  id: string
  name: string
  name_en: string | null
  icon: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  slot: 'weapon' | 'amulet' | 'compass' | 'pouch'
  description: string | null
  stats: Record<string, number>
}

export interface PuzzleRow {
  id: string
  room_id: string
  region_id: string
  title: string
  riddle: string
  riddle_en?: string | null
  answer_hash: string
  hint: string | null
  reward_xp: number
  reward_item_id: string | null
  status: string
  solver_count: number
  created_by: string | null
}

export interface PlayerTaskRow {
  id: string
  room_id: string
  region_id: string
  author_id: string | null
  prompt: string
  ai_title: string
  ai_desc: string
  reward_xp: number
  reward_item_id: string | null
  status: string
  created_at: string
}

export interface PlayerProfileRow {
  user_id: string
  display_name: string
  realm_level: number
  xp: number
  realm_title: string
  equipped: Record<string, string>
  total_solved: number
}

export interface WorldLogRow {
  id: string
  at: string
  user_id: string | null
  display_name: string
  location_id: string | null
  action: string
  result: string | null
  kind: string
  lang: string
}

export interface WorldEventRow {
  id: string
  title: string
  description: string
  icon: string
  ends_at: string | null
}

export interface HelpQaRow {
  id: string
  user_id: string | null
  question: string
  ai_answer: string
  at: string
}

export interface OpenWorldSnapshot {
  world: WorldRow
  regions: RegionRow[]
  rooms: RoomRow[]
  items: ItemRow[]
  puzzles: PuzzleRow[]
  tasks: PlayerTaskRow[]
  myProfile: PlayerProfileRow | null
  leaderboard: PlayerProfileRow[]
  log: WorldLogRow[]
  events: WorldEventRow[]
  myHelp: HelpQaRow[]
  mySolvedIds: string[]
}

// ── Cultivation ──
export function realmLevelFromXp(xp: number): number {
  const lvl = Math.floor(Math.sqrt(Math.max(0, xp) / 20)) + 1
  return Math.min(9, Math.max(1, lvl))
}

export function xpForLevel(level: number): number {
  return Math.pow(level - 1, 2) * 20
}

export const REALM_TITLES: Record<Lang, string[]> = {
  zh: ['潮汐使徒', '拾贝弟子', '观潮行者', '破浪使者', '汐域守望', '月光骑士', '深渊行者', '星引使者', '启元者'],
  'zh-TW': ['潮汐使徒', '拾貝弟子', '觀潮行者', '破浪使者', '汐域守望', '月光騎士', '深淵行者', '星引使者', '啟元者'],
  en: ['Tide Apostle', 'Shell Disciple', 'Tide Walker', 'Wave Breaker', 'Tide Watcher', 'Moon Knight', 'Abyss Walker', 'Star Guide', 'Genesis Bearer'],
  ja: ['潮の使徒', '貝拾いの弟子', '観潮の行者', '波を砕く者', '潮域の見守りびと', '月光の騎士', '深淵の歩行者', '星引の使者', '啓元の担い手'],
  fr: ['Apôtre de la Marée', 'Disciple Coquillage', 'Marcheur de Marée', 'Brise-Vague', 'Veilleur de Marée', 'Chevalier de Lune', 'Marcheur d’Abysse', 'Guide Stellaire', 'Porteur de Genèse'],
  es: ['Apóstol de la Marea', 'Discípulo de Conchas', 'Caminante de Marea', 'Rompeolas', 'Vigía de Marea', 'Caballero Lunar', 'Caminante del Abismo', 'Guía Estelar', 'Portador de Génesis'],
  de: ['Gezeiten-Apostel', 'Muschel-Schüler', 'Gezeiten-Wanderer', 'Wellenbrecher', 'Gezeiten-Wächter', 'Mondritter', 'Abgrund-Wanderer', 'Sternenführer', 'Genesis-Träger'],
  ko: ['조수 사도', '조개 제자', '조수 순례자', '파도 파괴자', '조수 파수꾼', '달빛 기사', '심연 순례자', '별 이끄는 자', '기원 Bearer'],
  it: ['Apostolo della Marea', 'Discepolo delle Conchiglie', 'Viandante della Marea', 'Frangi-Onda', 'Vigile della Marea', 'Cavaliere Lunare', 'Viandante dell’Abisso', 'Guida Stellare', 'Portatore della Genesi'],
  ar: ['رسول المد', 'تلميذ الأصداف', 'سائر المد', 'كاسر الموج', 'حارس المد', 'فارس القمر', 'سائر الهاوية', 'مرشد النجوم', 'حامل التكوين'],
}

export function realmTitleOf(level: number, lang: Lang): string {
  const titles = REALM_TITLES[lang] ?? REALM_TITLES.en
  return titles[Math.min(titles.length, Math.max(1, level)) - 1] ?? titles[0] as string
}

export function normalizeAnswer(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}
