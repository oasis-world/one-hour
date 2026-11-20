// Mirrored from src/lib/hourRole.ts — must stay in sync.
// A room broadcaster persona that rotates every wall-clock hour.

export interface HourRole {
  key: string
  name: string
  nameI18n: Record<string, string>
  role: Record<string, string>
  emoji: string
  avatarStyle: string
  avatarSeed: string
}

export const HOUR_ROLES: HourRole[] = [
  { key: 'lantern', name: '灯灯', emoji: '🏮', avatarStyle: 'bottts', avatarSeed: 'hour-lantern',
    nameI18n: { zh: '灯灯', 'zh-TW': '燈燈', en: 'Lantern', ja: 'ランタン', fr: 'Lanterne', es: 'Linterna', de: 'Laterne', ko: '등불', it: 'Lanterna', ar: 'فانوس' },
    role: { zh: '本小时的值班灯', 'zh-TW': '本小時的值班燈', en: 'The Hour Lantern', ja: '今時間の提灯', fr: 'La Lanterne de l’heure', es: 'La Linterna de la hora', de: 'Die Stundentlaterne', ko: '이 시간의 등불', it: 'La Lanterna dell’ora', ar: 'فانوس الساعة', fallback: 'Hour Host' } },
  { key: 'compass', name: '小罗', emoji: '🧭', avatarStyle: 'pixel-art', avatarSeed: 'hour-compass',
    nameI18n: { zh: '小罗', 'zh-TW': '小羅', en: 'Compass', ja: 'コンパス', fr: 'Boussole', es: 'Brújula', de: 'Kompass', ko: '나침반', it: 'Bussola', ar: 'بوصلة' },
    role: { zh: '本小时的向导', 'zh-TW': '本小時的嚮導', en: 'The Hour Guide', ja: '今時間の案内人', fr: 'Le Guide de l’heure', es: 'El Guía de la hora', de: 'Der Stundenführer', ko: '이 시간의 안내자', it: 'La Guida dell’ora', ar: 'دليل الساعة', fallback: 'Hour Host' } },
  { key: 'teapot', name: '茶茶', emoji: '🍵', avatarStyle: 'avataaars', avatarSeed: 'hour-teapot',
    nameI18n: { zh: '茶茶', 'zh-TW': '茶茶', en: 'Teatime', ja: 'お茶', fr: 'Théière', es: 'Tetera', de: 'Teekanne', ko: '찻잔', it: 'Teiera', ar: 'إبريق شاي' },
    role: { zh: '本小时的茶倌', 'zh-TW': '本小時的茶倌', en: 'The Hour Tea Keeper', ja: '今時間のお茶係', fr: 'Le Théier de l’heure', es: 'El Té de la hora', de: 'Der Teewärter', ko: '이 시간의 찻잔', it: 'Il Tè dell’ora', ar: 'شاي الساعة', fallback: 'Hour Host' } },
  { key: 'owl', name: '夜枭', emoji: '🦉', avatarStyle: 'thumbs', avatarSeed: 'hour-owl',
    nameI18n: { zh: '夜枭', 'zh-TW': '夜梟', en: 'Owl', ja: 'フクロウ', fr: 'Hibou', es: 'Búho', de: 'Eule', ko: '올빼미', it: 'Gufo', ar: 'بومة' },
    role: { zh: '本小时的守夜人', 'zh-TW': '本小時的守夜人', en: 'The Hour Night Owl', ja: '今時間の見回り', fr: 'Le Hibou de l’heure', es: 'El Búho de la hora', de: 'Die Nachteule', ko: '이 시간의 올빼미', it: 'Il Gufo dell’ora', ar: 'بومة الساعة', fallback: 'Hour Host' } },
  { key: 'mail', name: '邮差', emoji: '✉️', avatarStyle: 'lorelei', avatarSeed: 'hour-mail',
    nameI18n: { zh: '邮差', 'zh-TW': '郵差', en: 'Courier', ja: '郵便屋', fr: 'Courrier', es: 'Mensajero', de: 'Bote', ko: '사신', it: 'Corriere', ar: 'ساعي' },
    role: { zh: '本小时的信使', 'zh-TW': '本小時的信使', en: 'The Hour Courier', ja: '今時間の郵便屋', fr: 'Le Courrier de l’heure', es: 'El Mensajero de la hora', de: 'Der Stundebote', ko: '이 시간의 사신', it: 'Il Corriere dell’ora', ar: 'ساعي الساعة', fallback: 'Hour Host' } },
  { key: 'star', name: '星星', emoji: '⭐', avatarStyle: 'notionists', avatarSeed: 'hour-star',
    nameI18n: { zh: '星星', 'zh-TW': '星星', en: 'Star', ja: '星', fr: 'Étoile', es: 'Estrella', de: 'Stern', ko: '별', it: 'Stella', ar: 'نجم' },
    role: { zh: '本小时的许愿星', 'zh-TW': '本小時的許願星', en: 'The Hour Star', ja: '今時間の星', fr: 'L’Étoile de l’heure', es: 'La Estrella de la hora', de: 'Der Stundenstern', ko: '이 시간의 별', it: 'La Stella dell’ora', ar: 'نجم الساعة', fallback: 'Hour Host' } },
]

function hash32(n: number): number {
  let h = 2166136261
  const s = String(n)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const HOUR_MS = 60 * 60 * 1000
export function hourBucket(now = Date.now()): number { return Math.floor(now / HOUR_MS) }
export function roleForHour(now = Date.now()): HourRole {
  return HOUR_ROLES[hash32(hourBucket(now)) % HOUR_ROLES.length]!
}
export function hourRoleExpiresAt(now = Date.now()): number { return (hourBucket(now) + 1) * HOUR_MS }
export function roleLabel(role: HourRole, lang: string): string { return role.role[lang] ?? role.role.fallback }
export function roleDisplayName(role: HourRole, lang: string): string {
  return role.nameI18n[lang] ?? role.nameI18n.en ?? role.name
}
