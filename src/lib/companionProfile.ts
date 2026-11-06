import { randomAvatarLook } from './avatar'
import { getLang, type Lang } from './i18n'
import { randomNickname } from './userProfile'
import { vaultGetSync, vaultRemove, vaultSet } from './vault'

export interface CompanionProfile {
  id: string
  name: string
  role: string
  style: string
  seed: string
  avatarUrl?: string | null
  createdAt: number
  expiresAt: number
}

const COMPANION_KEY = 'one-hour-companion-profile'
const COMPANION_VAULT_KEY = 'one-hour-vault:companion'

let cached: CompanionProfile | null | undefined
const listeners = new Set<(c: CompanionProfile | null) => void>()

function companionRole(lang: Lang): string {
  const map: Record<string, string> = {
    zh: '你的伙伴', 'zh-TW': '你的夥伴', en: 'Your companion',
    ja: 'あなたのコンパニオン', fr: 'Ton compagnon', es: 'Tu compañero',
    de: 'Dein Begleiter', ko: '당신의 동반자', it: 'Il tuo compagno', ar: 'رفيقك',
  }
  return map[lang] ?? map[getLang()] ?? '你的伙伴'
}

export function loadCompanionProfile(): CompanionProfile | null {
  if (cached !== undefined) return cached
  try {
    let raw = globalThis.localStorage?.getItem(COMPANION_KEY)
    if (!raw) raw = vaultGetSync(COMPANION_VAULT_KEY)
    if (raw) {
      try { globalThis.localStorage?.setItem(COMPANION_KEY, raw) } catch { /* noop */ }
      cached = parseCompanion(raw)
    } else cached = null
  } catch { cached = null }
  return cached
}

export function saveCompanionProfile(c: CompanionProfile): void {
  cached = c
  const raw = JSON.stringify(c)
  try { globalThis.localStorage?.setItem(COMPANION_KEY, raw) } catch { /* noop */ }
  vaultSet(COMPANION_VAULT_KEY, raw)
  for (const fn of listeners) fn(c)
}

export function clearCompanionProfile(): void {
  cached = null
  try { globalThis.localStorage?.removeItem(COMPANION_KEY) } catch { /* noop */ }
  vaultRemove(COMPANION_VAULT_KEY)
  for (const fn of listeners) fn(null)
}

export function isCompanionExpired(c: CompanionProfile | null, now = Date.now()): boolean {
  if (!c) return true
  return now >= c.expiresAt
}

export function getCompanionIfAlive(): CompanionProfile | null {
  const c = loadCompanionProfile()
  if (!c) return null
  if (isCompanionExpired(c)) { clearCompanionProfile(); return null }
  return c
}

export function subscribeCompanion(fn: (c: CompanionProfile | null) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function useCompanionProfileSync(): void {
  // helper for storage event parity; components use useState+subscribe
}

function parseCompanion(raw: string): CompanionProfile | null {
  try {
    const d = JSON.parse(raw) as Partial<CompanionProfile>
    if (typeof d.name === 'string' && d.name && typeof d.style === 'string' && d.style && typeof d.seed === 'string' && d.seed) {
      return {
        id: typeof d.id === 'string' ? d.id : `companion-${d.seed}`,
        name: d.name, role: typeof d.role === 'string' ? d.role : companionRole(getLang()),
        style: d.style, seed: d.seed, avatarUrl: typeof d.avatarUrl === 'string' ? d.avatarUrl : null,
        createdAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
        expiresAt: typeof d.expiresAt === 'number' ? d.expiresAt : Date.now() + 60 * 60 * 1000,
      }
    }
  } catch { /* corrupt */ }
  return null
}

export function generateCompanionProfile(userNickname: string, userRole: string, opts?: { lang?: Lang; expiresAt?: number }): CompanionProfile {
  const lang = opts?.lang ?? getLang()
  const look = randomAvatarLook(null)
  let name = randomNickname(null, lang)
  // avoid collision with user nickname
  let tries = 0
  while (name === userNickname && tries < 5) { name = randomNickname(name, lang); tries++ }
  const now = Date.now()
  const c: CompanionProfile = {
    id: `companion-${look.seed}-${Math.random().toString(36).slice(2, 6)}`,
    name, role: companionRole(lang), style: look.style, seed: look.seed, avatarUrl: null,
    createdAt: now, expiresAt: opts?.expiresAt ?? (now + 60 * 60 * 1000),
  }
  void userNickname; void userRole
  return c
}

export function companionRoleLabel(lang: Lang = getLang()): string { return companionRole(lang) }
