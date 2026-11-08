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
  ko: ['조수 사도', '조개 제자', '조수 순례자', '파도 파괴자', '조수 파수꾼', '달빛 기사', '심연 순례자', '별 이끄는 자', '기원을 여는 자'],
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

// ── 12 mainline seeds (zh + en riddle, hash-checked). Title/riddle/hint
// are stored bilingual so each UI language sees only its own side.
export interface PuzzleSeed {
  id: string; room: string; region: string
  titleZh: string; titleEn: string
  riddleZh: string; riddleEn: string
  answer: string; hintZh: string; hintEn: string
  xp: number; item: string | null
}

export const PUZZLE_SEEDS: PuzzleSeed[] = [
  { id: 'p-seal-01', room: 'plaza_center', region: 'plaza', titleZh: '第一道微光', titleEn: 'First Glimmer', riddleZh: '沙漏核心的心跳，每刻几分？（数字）', riddleEn: 'How many minutes does the Hourglass Core beat?', answer: '60', hintZh: '一小时。', hintEn: 'One hour.', xp: 20, item: 'item-tide-pouch' },
  { id: 'p-seal-02', room: 'tavern_hall', region: 'tavern', titleZh: '归人炉火', titleEn: 'Hearth of Return', riddleZh: '炉火永不熄灭的地方，是哪座酒馆？', riddleEn: 'Which tavern never lets its hearth die?', answer: '归人酒馆', hintZh: '名字里有归人。', hintEn: 'Returners.', xp: 20, item: null },
  { id: 'p-seal-03', room: 'forest_lake', region: 'forest', titleZh: '月光湖影', titleEn: 'Moon Lake Shadow', riddleZh: '月光湖里倒映的不是月亮，是什么的影子？', riddleEn: 'What shadow does Moon Lake reflect, if not the moon?', answer: '潮汐', hintZh: '世界的名字。', hintEn: 'The world name.', xp: 25, item: 'item-moon-vial' },
  { id: 'p-seal-04', room: 'city_market', region: 'city', titleZh: '夜市暗号', titleEn: 'Night Market Code', riddleZh: '夜市里情报与危险同样密集——用两个字说出这座城？', riddleEn: 'Intel and danger in equal measure — name this city in two words in Chinese.', answer: '霓虹', hintZh: '雨夜永亮的字。', hintEn: 'Never-sleeping neon.', xp: 25, item: 'item-dawn-amulet' },
  { id: 'p-seal-05', room: 'ruin_hall', region: 'ruin', titleZh: '回声大厅', titleEn: 'Echo Hall', riddleZh: '被遗忘王朝的回声，最先封存了什么？', riddleEn: 'What did the forgotten dynasty seal first?', answer: '时间', hintZh: '这座城被谁遗忘？', hintEn: 'Who forgot this city?', xp: 30, item: null },
  { id: 'p-seal-06', room: 'lab_core', region: 'lab', titleZh: '反应炉心', titleEn: 'Reactor Core', riddleZh: '废弃实验场里仍在低鸣的机器，鸣的是什么？', riddleEn: 'What hums in the abandoned lab?', answer: '时空', hintZh: '空间与时间。', hintEn: 'Space and time.', xp: 30, item: 'item-star-compass' },
  { id: 'p-seal-07', room: 'ocean_shore', region: 'ocean', titleZh: '礁海岸', titleEn: 'Reef Shore', riddleZh: '礁海岸最先听见的，是什么的声音？', riddleEn: 'What sound does Reef Shore hear first?', answer: '潮汐', hintZh: '一小时的节拍。', hintEn: 'The hourly beat.', xp: 25, item: 'item-tide-blade' },
  { id: 'p-seal-08', room: 'forest_shrine', region: 'forest', titleZh: '古祠灯芯', titleEn: 'Shrine Wick', riddleZh: '古老神祠里，守护者记得什么？', riddleEn: 'What does the old shrine remember?', answer: '名字', hintZh: '古树记得的。', hintEn: 'Trees remember.', xp: 35, item: 'item-abyss-lantern' },
  { id: 'p-seal-09', room: 'city_vault', region: 'city', titleZh: '金库的钥匙', titleEn: 'Vault Key', riddleZh: '金库紧锁的，是谁的来路？', riddleEn: 'Whose origin does the Vault lock away?', answer: '归人', hintZh: '归来之人的。', hintEn: 'Of the returners.', xp: 40, item: 'item-gold-key' },
  { id: 'p-seal-10', room: 'ruin_library', region: 'ruin', titleZh: '尘封书库', titleEn: 'Dusty Archive', riddleZh: '书库的 poussière 里，封着谁的誓言？', riddleEn: 'Whose vow sleeps in the dusty archive?', answer: '沙漏', hintZh: '永恒的那一件。', hintEn: 'The eternal one.', xp: 40, item: null },
  { id: 'p-seal-11', room: 'academy_vault', region: 'academy', titleZh: '禁书库', titleEn: 'Forbidden Vault', riddleZh: '学者追逐永恒，禁书库锁的是什么？', riddleEn: 'What do scholars chase that the Vault locks?', answer: '永恒', hintZh: '追逐的对象。', hintEn: 'What they chase.', xp: 50, item: 'item-tide-core' },
  { id: 'p-seal-12', room: 'plaza_north', region: 'plaza', titleZh: '星辰大道', titleEn: 'Starlight Avenue', riddleZh: '大道通向学院正门，门上刻着哪两个字？', riddleEn: 'What two Chinese characters are carved on the Academy gate?', answer: '星辰', hintZh: '学院的名字。', hintEn: 'The academy name.', xp: 20, item: null },
]

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}
