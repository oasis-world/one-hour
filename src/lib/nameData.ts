import type { Lang } from './i18n'
import { HUMAN_NAMES as EAST_ASIA } from './names/eastAsia'
import { HUMAN_NAMES as KOREA_ARABIA } from './names/koreaArabia'
import { HUMAN_NAMES as WESTERN_EUROPE } from './names/westernEurope'
import { HUMAN_NAMES as SOUTHERN_EUROPE } from './names/southernEurope'
import { ROLE_WORDS as CJK_ARABIA_ROLES } from './names/cjkArabiaRoles'
import { ROLE_WORDS as EUROPE_ROLES } from './names/europeRoles'

/**
 * Real human names and occupations for every app language. The actual
 * word banks live in src/lib/names/ (one file per region, kept small).
 * Names = given × family; roles = domain × occupation.
 */

export interface HumanNameBank {
  given: readonly string[]
  family: readonly string[]
}

export interface RoleBank {
  occupations: readonly string[]
  domains: readonly string[]
}

const nameBanks = { ...EAST_ASIA, ...KOREA_ARABIA, ...WESTERN_EUROPE, ...SOUTHERN_EUROPE }
const roleBanks = { ...CJK_ARABIA_ROLES, ...EUROPE_ROLES }

export const HUMAN_NAMES_BY_LANG = {
  ...nameBanks,
  'zh-TW': nameBanks.zh!,
} as Record<Lang, HumanNameBank>

export const ROLE_WORDS_BY_LANG = {
  ...roleBanks,
  'zh-TW': roleBanks.zh!,
} as Record<Lang, RoleBank>

/** CJK family names come first and concatenate; scripts with spaces keep given→family. */
export function isCjkLang(lang: Lang): boolean {
  return lang === 'zh' || lang === 'zh-TW' || lang === 'ja' || lang === 'ko'
}
