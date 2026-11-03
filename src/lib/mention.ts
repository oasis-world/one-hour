import type { CompanionProfile } from './companionProfile'
import { getCompanionIfAlive } from './companionProfile'
import { loadUserProfile } from './userProfile'

export function containsCompanionMention(text: string, companion: CompanionProfile | null): boolean {
  if (!companion || !text) return false
  return text.includes(`@${companion.name}`)
}

export function parseMentions(text: string): Array<{ type: 'text' | 'mention'; value: string }> {
  if (!text) return [{ type: 'text', value: text }]
  const companion = getCompanionIfAlive()
  const user = loadUserProfile()
  const knownNames: string[] = []
  if (companion?.name) knownNames.push(companion.name)
  if (user?.nickname) knownNames.push(user.nickname)
  const uniq = Array.from(new Set(knownNames)).sort((a, b) => b.length - a.length)

  const out: Array<{ type: 'text' | 'mention'; value: string }> = []
  let i = 0
  while (i < text.length) {
    if (text[i] === '@') {
      let matched: string | null = null
      for (const name of uniq) {
        if (text.startsWith(name, i + 1)) {
          matched = name
          break
        }
      }
      if (matched) {
        out.push({ type: 'mention', value: `@${matched}` })
        i += 1 + matched.length
        continue
      }
      // stray @ with no known name — no highlight, fall through to text
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
