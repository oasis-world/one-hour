import type { CompanionProfile } from './companionProfile'
import { getCompanionIfAlive } from './companionProfile'
import { loadUserProfile } from './userProfile'

export function containsCompanionMention(text: string, companion: CompanionProfile | null): boolean {
  if (!companion || !text) return false
  return text.includes(`@${companion.name}`)
}

export function parseMentions(text: string, extraNames?: string[]): Array<{ type: 'text' | 'mention'; value: string }> {
  if (!text) return [{ type: 'text', value: text }]
  const companion = getCompanionIfAlive()
  const user = loadUserProfile()
  const knownNames: string[] = []
  if (companion?.name) knownNames.push(companion.name)
  if (user?.nickname) knownNames.push(user.nickname)
  if (extraNames) for (const n of extraNames) if (n) knownNames.push(n)
  // Fallback: extract any @... sequences so foreign mentions still highlight
  // Supports multi-word names like "Amber Lantern" by capturing up to next @ or punctuation
  // We iterate over text to find @ segments and push their trimmed content as candidates
  const atSegments: string[] = []
  let searchIdx = 0
  while (searchIdx < text.length) {
    const at = text.indexOf('@', searchIdx)
    if (at === -1) break
    // Take up to 40 chars or next @, whichever first, then trim to word boundaries
    const nextAt = text.indexOf('@', at + 1)
    const end = nextAt === -1 ? Math.min(text.length, at + 41) : Math.min(nextAt, at + 41)
    const seg = text.slice(at + 1, end).trim()
    // Clean trailing punctuation
    const cleaned = seg.replace(/[,!?.，。！？、]+$/g, '').trim()
    if (cleaned) atSegments.push(cleaned)
    searchIdx = at + 1
  }
  for (const c of atSegments) knownNames.push(c)
  const uniq = Array.from(new Set(knownNames.filter(Boolean))).sort((a, b) => b.length - a.length)

  const out: Array<{ type: 'text' | 'mention'; value: string }> = []
  let i = 0
  while (i < text.length) {
    if (text[i] === '@') {
      let matched: string | null = null
      for (const name of uniq) {
        if (text.startsWith(name, i + 1)) {
          // Ensure name boundary: next char is not a letter/number (avoid partial matches)
          const after = text[i + 1 + name.length]
          if (after && /[\p{L}\p{N}]/u.test(after)) continue
          matched = name
          break
        }
      }
      if (matched) {
        out.push({ type: 'mention', value: `@${matched}` })
        i += 1 + matched.length
        continue
      }
    }
    const nextAt = text.indexOf('@', i + 1)
    const end = nextAt === -1 ? text.length : nextAt
    out.push({ type: 'text', value: text.slice(i, end) })
    i = end
  }
  const merged: typeof out = []
  for (const p of out) {
    if (p.value === '') continue
    if (merged.length && merged[merged.length - 1].type === 'text' && p.type === 'text') {
      merged[merged.length - 1].value += p.value
    } else {
      merged.push(p)
    }
  }
  return merged.length ? merged : [{ type: 'text', value: text }]
}
