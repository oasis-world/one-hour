/**
 * Detect user intent to enter private chat with the companion.
 * Covers all 10 locales; matching is intentionally lenient so variants
 * like "进入私聊模式" / "enter private chat" all trigger.
 */
export function isEnterPrivateChatIntent(text: string): boolean {
  if (!text) return false
  const t = text.toLowerCase()
  // Chinese (zh / zh-TW): 私聊 is the core keyword
  if (t.includes('私聊')) return true
  if (t.includes('進入私聊') || t.includes('进入私聊')) return true
  // Japanese: プライベート
  if (t.includes('プライベート')) return true
  // Korean: 프라이빗 / 비공개
  if (t.includes('프라이빗') || t.includes('비공개')) return true
  // Arabic: خاص / الخاصة (private chat keywords)
  if (t.includes('دردشة خاصة') || t.includes('محادثة خاصة') || t.includes('الخاص')) return true
  // English & catch-all latin: "private chat" / "private mode"
  if (t.includes('private chat') || t.includes('private mode') || t.includes('enter private') || t.includes('go private')) return true
  // French
  if (t.includes('chat privé') || t.includes('mode privé') || t.includes('discussion privée')) return true
  // Spanish
  if (t.includes('chat privado') || t.includes('modo privado')) return true
  // German
  if (t.includes('privater chat') || t.includes('privater modus') || t.includes('privat chat')) return true
  // Italian
  if (t.includes('chat privato') || t.includes('modalità privata')) return true
  return false
}
