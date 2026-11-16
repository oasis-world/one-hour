import { getLang, type Lang } from './i18n'
import { HUMAN_NAMES_BY_LANG, ROLE_WORDS_BY_LANG, isCjkLang } from './nameData'

/**
 * Random nicknames and roles built from real human names and occupations.
 * No numeric tails: a name is a given name × a family name (tens of
 * thousands of combinations per language), a role is a domain × an
 * occupation (1,000+ per language). Recent values are remembered so a few
 * rerolls never hand back something you just saw.
 */

/** Unbiased integer in [0, max) — crypto when available, Math.random otherwise. */
function randomInt(max: number): number {
  if (max <= 1) return 0
  const crypto = globalThis.crypto
  if (crypto?.getRandomValues) {
    const limit = Math.floor(0x100000000 / max) * max
    const buf = new Uint32Array(1)
    let n: number
    do {
      crypto.getRandomValues(buf)
      n = buf[0]!
    } while (n >= limit)
    return n % max
  }
  return Math.floor(Math.random() * max)
}

const RECENT_NAME_COUNT = 256
const RECENT_ROLE_COUNT = 256
const MAX_ATTEMPTS = 32

const recentNames = new Map<Lang, string[]>()
const recentRoles = new Map<Lang, string[]>()

function fresh(
  make: () => string,
  previous: string | null | undefined,
  recent: readonly string[],
): string {
  const blocked = new Set(recent)
  if (previous) blocked.add(previous)
  let value = make()
  for (let i = 0; i < MAX_ATTEMPTS && blocked.has(value); i++) value = make()
  return value
}

function remember(store: Map<Lang, string[]>, lang: Lang, value: string, cap: number): void {
  const next = [value, ...(store.get(lang) ?? []).filter((v) => v !== value)].slice(0, cap)
  store.set(lang, next)
}

export function randomNickname(previous?: string | null, lang: Lang = getLang()): string {
  const { given, family } = HUMAN_NAMES_BY_LANG[lang]
  const make = () => (isCjkLang(lang)
    ? `${family[randomInt(family.length)]}${given[randomInt(given.length)]}`
    : `${given[randomInt(given.length)]} ${family[randomInt(family.length)]}`)
  const recent = recentNames.get(lang) ?? []
  const name = fresh(make, previous, recent)
  remember(recentNames, lang, name, RECENT_NAME_COUNT)
  return name
}

export function randomRole(previous?: string | null, lang: Lang = getLang()): string {
  const { occupations, domains } = ROLE_WORDS_BY_LANG[lang]
  const sep = isCjkLang(lang) ? '' : ' '
  const make = () =>
    `${domains[randomInt(domains.length)]}${sep}${occupations[randomInt(occupations.length)]}`
  const recent = recentRoles.get(lang) ?? []
  const role = fresh(make, previous, recent)
  remember(recentRoles, lang, role, RECENT_ROLE_COUNT)
  return role
}
