import type { PresenceMember } from './chatTypes'

function detectScriptLang(text: string): string {
  if (/[\u0600-\u06FF]/.test(text)) return 'ar'
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja'
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) return 'ko'
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh'
  if (/[àâéèêëîïôùûüÿçœæ]/i.test(text)) return 'fr'
  if (/[ñáéíóúü¿¡]/i.test(text)) return 'es'
  if (/[äöüß]/i.test(text)) return 'de'
  if (/[àèéìòù]/i.test(text)) return 'it'
  return 'en'
}

function memberLang(m: PresenceMember): string {
  if (m.lang) return m.lang
  const combined = `${m.displayName} ${m.role ?? ''}`
  return detectScriptLang(combined)
}

function isCompanionMember(m: PresenceMember): boolean {
  return m.userId.startsWith('companion-')
}

export function selectMudParty(
  presence: PresenceMember[],
  selfId: string | null,
  companionId: string | null,
): PresenceMember[] | null {
  // Never include any virtual assistant: filter self, caller's companion, and any companion- id
  const pool = presence.filter((p) => p.userId !== selfId && p.userId !== companionId && !isCompanionMember(p))
  if (pool.length < 2) return null
  const groups = new Map<string, PresenceMember[]>()
  for (const m of pool) {
    const lang = memberLang(m)
    const arr = groups.get(lang) ?? []
    arr.push(m)
    groups.set(lang, arr)
  }
  // Find largest language group
  let bestLang = ''
  let best: PresenceMember[] = []
  for (const [lang, arr] of groups) {
    if (arr.length > best.length) { best = arr; bestLang = lang }
  }
  // Always prioritize same language, but fill to 2-5 even if languages differ
  let result: PresenceMember[] = [...best].sort((a, b) => a.enteredAt - b.enteredAt)
  if (result.length < 5) {
    const rest = pool.filter((p) => memberLang(p) !== bestLang).sort((a, b) => a.enteredAt - b.enteredAt)
    for (const m of rest) {
      if (result.length >= 5) break
      result.push(m)
    }
  }
  if (result.length < 2) return null
  // If we have more than needed, keep language-pure first, shuffle only overflow candidates
  const count = Math.min(5, Math.max(2, result.length))
  if (result.length > count) {
    // Keep first `count` as-is to preserve language priority ordering
    result = result.slice(0, count)
  }
  return result
}

export function partyLangLabel(party: PresenceMember[]): string {
  if (!party.length) return 'en'
  return memberLang(party[0])
}
