export function isMudRecreateIntent(text: string): boolean {
  const t = text.toLowerCase()
  return /重新创建|再来一局|再创建|重开|recreate|new mud|create.*mud|another mud/i.test(t)
}
