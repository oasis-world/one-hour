/** Broad MUD invite intent: user @ companion asks to start/invite a MUD game. */
export function isMudInviteIntent(text: string): boolean {
  if (/mud/i.test(text)) return true
  // Chinese invite phrasings without explicit "mud" latin (rare) — e.g. "文字冒险"
  const t = text.toLowerCase()
  return /文字冒险|mud游戏|mud\s*冒险/i.test(t)
}
