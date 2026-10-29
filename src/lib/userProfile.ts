import { useEffect, useState } from 'react'
import { getLang, type Lang } from './i18n'
import { isKnownStyle, randomAvatarLook, type AvatarLook } from './avatar'
import { VAULT_KEYS, vaultGetSync, vaultRemove, vaultSet } from './vault'

/**
 * Local player profile: the nickname + DiceBear look confirmed in the
 * welcome flow (or later edited on the profile page). Lives in
 * localStorage for guests; a signed-in player's copy also syncs to the
 * cloud `profiles` table (see profileCloud.ts).
 */

export interface UserProfile extends AvatarLook {
  nickname: string
  /** Free-text role/title shown next to the nickname (e.g. student, engineer). */
  role?: string
  /** Custom photo avatar (public storage URL); wins over style + seed. */
  avatarUrl?: string | null
}

/** Schema guardrail shared with the cloud table (char_length 1..40). */
export const NICKNAME_MAX = 20
export const ROLE_MAX = 20
export const PROFILE_LIFETIME_MS = 60 * 60 * 1000

const PROFILE_KEY = 'one-hour-user-profile'

let cached: UserProfile | null | undefined
const listeners = new Set<(p: UserProfile | null) => void>()

export function loadUserProfile(): UserProfile | null {
  if (cached !== undefined) return cached
  try {
    let raw = globalThis.localStorage?.getItem(PROFILE_KEY)
    if (!raw) raw = vaultGetSync(VAULT_KEYS.profile)
    if (raw) {
      // Heal the primary store if it was wiped.
      try {
        globalThis.localStorage?.setItem(PROFILE_KEY, raw)
      } catch {
        // best effort
      }
      cached = parseProfile(raw)
    } else {
      cached = null
    }
  } catch {
    cached = null
  }
  return cached
}

export function saveUserProfile(profile: UserProfile): void {
  cached = profile
  const raw = JSON.stringify(profile)
  try {
    globalThis.localStorage?.setItem(PROFILE_KEY, raw)
  } catch {
    // Private mode: profile lives for this session only.
  }
  vaultSet(VAULT_KEYS.profile, raw)
  for (const fn of listeners) fn(profile)
}

export function clearUserProfile(): void {
  cached = null
  try {
    globalThis.localStorage?.removeItem(PROFILE_KEY)
  } catch {
    // Private mode: nothing persisted.
  }
  vaultRemove(VAULT_KEYS.profile)
  for (const fn of listeners) fn(null)
}

export function resetPreWelcome(): void {
  preWelcome = null
}

const PROFILE_EXPIRES_KEY = 'one-hour-profile-expires-at'

export function setProfileExpiresAt(ts: number): void {
  const raw = String(ts)
  try {
    globalThis.localStorage?.setItem(PROFILE_EXPIRES_KEY, raw)
  } catch {
    // Private mode: expiry lives for this session only.
  }
  vaultSet(VAULT_KEYS.expiry, raw)
}

export function getProfileExpiresAt(): number | null {
  try {
    let raw = globalThis.localStorage?.getItem(PROFILE_EXPIRES_KEY)
    if (!raw) raw = vaultGetSync(VAULT_KEYS.expiry)
    if (!raw) return null
    const n = Number(raw)
    if (Number.isFinite(n)) {
      // Heal primary store.
      try {
        globalThis.localStorage?.setItem(PROFILE_EXPIRES_KEY, raw)
      } catch {
        // best effort
      }
      return n
    }
    return null
  } catch {
    return null
  }
}

export function clearProfileExpiresAt(): void {
  try {
    globalThis.localStorage?.removeItem(PROFILE_EXPIRES_KEY)
  } catch {
    // Private mode: nothing persisted.
  }
  vaultRemove(VAULT_KEYS.expiry)
}

export function subscribeProfile(fn: (p: UserProfile | null) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useUserProfile(): UserProfile | null {
  const [profile, setProfile] = useState<UserProfile | null>(loadUserProfile)
  useEffect(() => subscribeProfile(setProfile), [])
  return profile
}

function parseProfile(raw: string): UserProfile | null {
  try {
    const data = JSON.parse(raw) as Partial<UserProfile>
    if (
      typeof data.nickname === 'string' &&
      data.nickname.length > 0 &&
      typeof data.seed === 'string' &&
      data.seed.length > 0 &&
      isKnownStyle(data.style)
    ) {
      return {
        nickname: data.nickname,
        role: typeof data.role === 'string' ? data.role.slice(0, ROLE_MAX) : '',
        style: data.style,
        seed: data.seed,
        avatarUrl: typeof data.avatarUrl === 'string' && data.avatarUrl ? data.avatarUrl : null,
      }
    }
  } catch {
    // Corrupt row: treat as a brand-new player.
  }
  return null
}

/** Trim + collapse whitespace + hard length cap, mirroring the table check. */
export function cleanNickname(input: string): string {
  const cleaned = input.replace(/\s+/g, ' ').trim().slice(0, NICKNAME_MAX)
  return cleaned
}

export function cleanRole(input: string): string {
  const cleaned = input.replace(/\s+/g, ' ').trim().slice(0, ROLE_MAX)
  return cleaned
}

/** A whole new random identity — the welcome screen's refresh action. */
export function randomProfile(
  previous?: UserProfile | null,
  lang: Lang = getLang(),
): UserProfile {
  return {
    nickname: randomNickname(previous?.nickname, lang),
    role: randomRole(previous?.role, lang),
    ...randomAvatarLook(previous),
    // A fresh generated identity drops any custom photo.
    avatarUrl: null,
  }
}

let preWelcome: UserProfile | null = null

/**
 * The random identity the room shows before the welcome confirm — rolled
 * once per session and shared by the identity layer, the top bar and the
 * welcome gate, so the face and name behind the modal are exactly the ones
 * the modal first offers. Confirming the gate saves it for real.
 */
export function preWelcomeProfile(): UserProfile {
  preWelcome ??= randomProfile(null)
  return preWelcome
}

/* ---- role catalog: 30 roles ---- */

const ROLES_ZH = [
  '学生', '工程师', '教师', '宇航员', '猎人', '医生', '艺术家', '作家',
  '音乐家', '厨师', '飞行员', '科学家', '探险家', '骑士', '法师', '忍者',
  '武士', '海盗', '侦探', '园丁', '建筑师', '程序员', '设计师', '摄影师',
  '运动员', '舞者', '演员', '记者', '图书管理员', '消防员',
]

const ROLES_EN = [
  'Student', 'Engineer', 'Teacher', 'Astronaut', 'Hunter', 'Doctor', 'Artist',
  'Writer', 'Musician', 'Chef', 'Pilot', 'Scientist', 'Explorer', 'Knight',
  'Mage', 'Ninja', 'Samurai', 'Pirate', 'Detective', 'Gardener', 'Architect',
  'Programmer', 'Designer', 'Photographer', 'Athlete', 'Dancer', 'Actor',
  'Journalist', 'Librarian', 'Firefighter',
]

const ROLES_JA = [
  '学生', 'エンジニア', '教師', '宇宙飛行士', 'ハンター', '医師', '芸術家', '作家',
  '音楽家', 'シェフ', 'パイロット', '科学者', '探検家', '騎士', '魔法使い', '忍者',
  '侍', '海賊', '探偵', '庭師', '建築家', 'プログラマー', 'デザイナー', '写真家',
  'アスリート', 'ダンサー', '俳優', '記者', '司書', '消防士',
]
const ROLES_FR = ['Étudiant', 'Ingénieur', 'Professeur', 'Astronaute', 'Chasseur', 'Médecin', 'Artiste', 'Écrivain', 'Musicien', 'Chef', 'Pilote', 'Scientifique', 'Explorateur', 'Chevalier', 'Mage', 'Ninja', 'Samouraï', 'Pirate', 'Détective', 'Jardinier', 'Architecte', 'Programmeur', 'Designer', 'Photographe', 'Athlète', 'Danseur', 'Acteur', 'Journaliste', 'Bibliothécaire', 'Pompier']
const ROLES_ES = ['Estudiante', 'Ingeniero', 'Profesor', 'Astronauta', 'Cazador', 'Médico', 'Artista', 'Escritor', 'Músico', 'Chef', 'Piloto', 'Científico', 'Explorador', 'Caballero', 'Mago', 'Ninja', 'Samurái', 'Pirata', 'Detective', 'Jardinero', 'Arquitecto', 'Programador', 'Diseñador', 'Fotógrafo', 'Atleta', 'Bailarín', 'Actor', 'Periodista', 'Bibliotecario', 'Bombero']
const ROLES_DE = ['Student', 'Ingenieur', 'Lehrer', 'Astronaut', 'Jäger', 'Arzt', 'Künstler', 'Autor', 'Musiker', 'Koch', 'Pilot', 'Forscher', 'Entdecker', 'Ritter', 'Magier', 'Ninja', 'Samurai', 'Pirat', 'Detektiv', 'Gärtner', 'Architekt', 'Programmierer', 'Designer', 'Fotograf', 'Sportler', 'Tänzer', 'Schauspieler', 'Journalist', 'Bibliothekar', 'Feuerwehrmann']
const ROLES_KO = ['학생', '엔지니어', '교사', '우주비행사', '사냥꾼', '의사', '예술가', '작가', '음악가', '요리사', '조종사', '과학자', '탐험가', '기사', '마법사', '닌자', '사무라이', '해적', '탐정', '정원사', '건축가', '프로그래머', '디자이너', '사진작가', '운동선수', '무용수', '배우', '기자', '사서', '소방관']
const ROLES_IT = ['Studente', 'Ingegnere', 'Insegnante', 'Astronauta', 'Cacciatore', 'Medico', 'Artista', 'Scrittore', 'Musicista', 'Cuoco', 'Pilota', 'Scienziato', 'Esploratore', 'Cavaliere', 'Mago', 'Ninja', 'Samurai', 'Pirata', 'Detective', 'Giardiniere', 'Architetto', 'Programmatore', 'Designer', 'Fotografo', 'Atleta', 'Ballerino', 'Attore', 'Giornalista', 'Bibliotecario', 'Pompiere']
const ROLES_AR = ['طالب', 'مهندس', 'معلم', 'رائد فضاء', 'صياد', 'طبيب', 'فنان', 'كاتب', 'موسيقي', 'طاهٍ', 'طيار', 'عالِم', 'مستكشف', 'فارس', 'ساحر', 'نينجا', 'ساموراي', 'قرصان', 'محقق', 'بستاني', 'معماري', 'مبرمج', 'مصمم', 'مصور', 'رياضي', 'راقص', 'ممثل', 'صحفي', 'أمين مكتبة', 'رجل إطفاء']

const ROLES_BY_LANG: Partial<Record<Lang, readonly string[]>> = {
  zh: ROLES_ZH, 'zh-TW': ROLES_ZH, ja: ROLES_JA, en: ROLES_EN,
  fr: ROLES_FR, es: ROLES_ES, de: ROLES_DE, ko: ROLES_KO, it: ROLES_IT, ar: ROLES_AR,
}

export function randomRole(previous?: string | null, lang: Lang = getLang()): string {
  const list = ROLES_BY_LANG[lang] ?? ROLES_EN
  const pick = () => list[Math.floor(Math.random() * list.length)]
  let role = pick()
  while (previous != null && previous !== '' && role === previous) role = pick()
  return role
}

/* ---- random nicknames: a mood word + a wanderer noun ---- */

const NICK_ZH_A = [
  '晚风', '星光', '微光', '云端', '远山', '落雪',
  '潮汐', '银河', '薄雾', '暖阳', '极光', '夜航',
]
const NICK_ZH_B = [
  '旅人', '候鸟', '灯塔', '星轨', '观星者', '拾贝人',
  '漫游者', '萤火虫', '信使', '鲸', '猫', '邮差',
]
const NICK_EN_A = [
  'Amber', 'Misty', 'Stellar', 'Lunar', 'Quiet', 'Drifting',
  'Velvet', 'Cobalt', 'Snowy', 'Ember', 'Aurora', 'Midnight',
]
const NICK_EN_B = [
  'Traveler', 'Crane', 'Whale', 'Lantern', 'Comet', 'Fox',
  'Sparrow', 'Beacon', 'Wanderer', 'Firefly', 'Curator', 'Pilgrim',
]
const NICK_JA_A = ['夕風', '星明かり', 'ほのかな光', '雲間', '遠い山', '初雪', '潮騒', '銀河', '薄霧', '朝日', 'オーロラ', '夜航']
const NICK_JA_B = ['旅人', '渡り鳥', '灯台', '星の軌跡', '星見', '貝拾い', '放浪者', '蛍', '使者', '鯨', '猫', '郵便屋']
const NICK_FR_A = ['Ambré', 'Brumeux', 'Étoilé', 'Lunaire', 'Paisible', 'Rêveur', 'Velours', 'Cobalt', 'Neigeux', 'Ardent', 'Aurore', 'Minuit']
const NICK_FR_B = ['Voyageur', 'Grue', 'Baleine', 'Lanterne', 'Comète', 'Renard', 'Moineau', 'Phare', 'Nomade', 'Luciole', 'Collectionneur', 'Pèlerin']
const NICK_ES_A = ['Ámbar', 'Brumoso', 'Estelar', 'Lunar', 'Tranquilo', 'Errante', 'Aterciopelado', 'Cobalto', 'Nevado', 'Brasas', 'Aurora', 'Medianoche']
const NICK_ES_B = ['Viajero', 'Grulla', 'Ballena', 'Farol', 'Cometa', 'Zorro', 'Gorrión', 'Faro', 'Nómada', 'Luciérnaga', 'Coleccionista', 'Peregrino']
const NICK_DE_A = ['Bernstein', 'Neblig', 'Sternenklar', 'Mondhell', 'Still', 'Treibend', 'Samtig', 'Kobaltblau', 'Schneeleicht', 'Glühend', 'Morgenrot', 'Mitternacht']
const NICK_DE_B = ['Reisender', 'Kranich', 'Wal', 'Laterne', 'Komet', 'Fuchs', 'Spatz', 'Leuchtturm', 'Wanderer', 'Glühwürmchen', 'Sammler', 'Pilger']
const NICK_KO_A = ['노을빛', '안개', '별빛', '달빛', '고요한', '흐르는', '벨벳', '코발트', '눈꽃', '불씨', '오로라', '한밤']
const NICK_KO_B = ['여행자', '두루미', '고래', '등불', '혜성', '여우', '참새', '등대', '방랑자', '반딧불이', '수집가', '순례자']
const NICK_IT_A = ['Ambra', 'Nebbia', 'Stellare', 'Lunare', 'Quieto', 'Errante', 'Velluto', 'Cobalto', 'Nevoso', 'Ardente', 'Aurora', 'Mezzanotte']
const NICK_IT_B = ['Viaggiatore', 'Gru', 'Balena', 'Lanterna', 'Cometa', 'Volpe', 'Passero', 'Faro', 'Vagabondo', 'Lucciola', 'Collezionista', 'Pellegrino']
const NICK_AR_A = ['كهرماني', 'ضبابي', 'نجمي', 'قمري', 'هادئ', 'تائه', 'مخملي', 'كوبالتي', 'ثلجي', 'متوهج', 'فجر', 'منتصف الليل']
const NICK_AR_B = ['مسافر', 'كركي', 'حوت', 'فانوس', 'مذنب', 'ثعلب', 'عصفور', 'منارة', 'جوال', 'يراعة', 'جامع', 'حاج']

const NICKNAMES_BY_LANG: Record<Lang, { a: readonly string[]; b: readonly string[] }> = {
  zh: { a: NICK_ZH_A, b: NICK_ZH_B },
  'zh-TW': { a: NICK_ZH_A, b: NICK_ZH_B },
  ja: { a: NICK_JA_A, b: NICK_JA_B },
  en: { a: NICK_EN_A, b: NICK_EN_B },
  fr: { a: NICK_FR_A, b: NICK_FR_B },
  es: { a: NICK_ES_A, b: NICK_ES_B },
  de: { a: NICK_DE_A, b: NICK_DE_B },
  ko: { a: NICK_KO_A, b: NICK_KO_B },
  it: { a: NICK_IT_A, b: NICK_IT_B },
  ar: { a: NICK_AR_A, b: NICK_AR_B },
}

/** Languages whose words are single characters — no space between parts. */
function isCjkLang(lang: Lang): boolean {
  return lang === 'zh' || lang === 'zh-TW' || lang === 'ja' || lang === 'ko'
}

export function randomNickname(previous?: string | null, lang: Lang = getLang()): string {
  const { a, b } = NICKNAMES_BY_LANG[lang]
  const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]
  const join = (x: string, y: string) => (isCjkLang(lang) ? `${x}${y}` : `${x} ${y}`)
  let name = join(pick(a), pick(b))
  while (previous != null && previous !== '' && name === previous) {
    name = join(pick(a), pick(b))
  }
  return name
}
