import { getSupabaseClient } from './supabaseClient'
import { isSupabaseConfigured } from './supabaseConfig'
import { buildCompanionSystemPrompt, buildGreetingPrompt } from './companionContext'
import type { CompanionProfile } from './companionProfile'
import type { CompanionMessage } from './companionStore'
import { loadUserProfile } from './userProfile'

export interface CompanionHistoryItem { role: 'user' | 'assistant'; content: string }
export type CompanionGameId = 'gomoku' | 'xiangqi' | 'chess'
export interface CompanionReply { reply: string; game: CompanionGameId | null }

function parseGame(v: unknown): CompanionGameId | null {
  return v === 'gomoku' || v === 'xiangqi' || v === 'chess' ? v : null
}

export async function requestCompanionReply(
  companion: CompanionProfile,
  userText: string,
  history: CompanionHistoryItem[],
): Promise<CompanionReply> {
  const user = loadUserProfile()
  if (!user) throw new Error('no user profile')
  const systemPrompt = buildCompanionSystemPrompt(user, companion)
  if (isSupabaseConfigured()) {
    try {
      const client = await getSupabaseClient()
      const { data, error } = await client.functions.invoke('companion-chat', {
        body: { systemPrompt, history, userText, companionName: companion.name, userName: user.nickname },
      })
      if (!error && data) {
        const reply = typeof data.reply === 'string' ? data.reply.trim() : ''
        if (reply) return { reply, game: parseGame(data.game) }
      }
      if (error) throw error
    } catch (e) { console.warn('[companion] cloud failed, fallback', e) }
  }
  return { reply: fallbackReply(user.nickname, companion.name, userText), game: null }
}

export async function requestCompanionGreeting(companion: CompanionProfile): Promise<string> {
  const user = loadUserProfile()
  if (!user) return `@${companion.name} 你好呀！我是你的助手，随时@我聊天吧～`
  const systemPrompt = buildCompanionSystemPrompt(user, companion)
  const greetingPrompt = buildGreetingPrompt(user, companion)
  if (isSupabaseConfigured()) {
    try {
      const client = await getSupabaseClient()
      const { data, error } = await client.functions.invoke('companion-chat', {
        body: { systemPrompt, history: [], userText: greetingPrompt, companionName: companion.name, userName: user.nickname, isGreeting: true },
      })
      if (!error && typeof data?.reply === 'string' && data.reply.trim()) return ensureMentionPrefix(data.reply.trim(), user.nickname)
    } catch (e) { console.warn('[companion] greeting cloud failed', e) }
  }
  const lang = (await import('./i18n')).getLang()
  const roleName = user.role ? `「${user.role}」` : ''
  const rolePart = lang === 'zh' ? `${roleName}` : lang === 'en' ? ` as ${user.role ?? 'adventurer'}` : `（${user.role ?? ''}）`
  const mudLines: Record<string, string> = {
    zh: `这里有一个 MUD 文字冒险《永恒沙漏》⏳，你可以用自己目前的角色 ${user.nickname}${rolePart} 来游玩 1 个小时，来享受吧！沙漏里的世界是永恒的，所有玩家共同书写历史。`,
    'zh-TW': `這裡有一個 MUD 文字冒險《永恆沙漏》⏳，你可以用自己目前的角色 ${user.nickname}${rolePart} 來遊玩 1 個小時，來享受吧！沙漏裡的世界是永恆的，所有玩家共同書寫歷史。`,
    en: `There's a MUD adventure here — The Eternal Hourglass ⏳. Jump in for an hour as ${user.nickname}${user.role ? ` (${user.role})` : ''} and enjoy it! The world is eternal, written together by all who enter.`,
    ja: `ここに MUD 冒険『永遠の砂時計』⏳があるよ。${user.nickname}${user.role ? `（${user.role}）` : ''}として1時間、この世界を楽しんで！永遠の世界は皆で紡がれるんだ。`,
    fr: `Une aventure MUD vous attend — Le Sablier Éternel ⏳. Incarnez ${user.nickname}${user.role ? ` (${user.role})` : ''} pendant une heure et profitez-en ! Le monde est éternel, écrit par tous.`,
    es: `Hay una aventura MUD aquí — El Reloj de Arena Eterno ⏳. Juega una hora como ${user.nickname}${user.role ? ` (${user.role})` : ''} ¡y disfrútalo! El mundo es eterno, escrito por todos.`,
    de: `Hier wartet ein MUD-Abenteuer — Die Ewige Sanduhr ⏳. Spiele eine Stunde als ${user.nickname}${user.role ? ` (${user.role})` : ''} und genieße es! Die Welt ist ewig, von allen geschrieben.`,
    ko: `여기에 MUD 어드벤처 ‘영원한 모래시계’⏳가 있어요. ${user.nickname}${user.role ? `(${user.role})` : ''}로 1시간 동안 즐겨봐요! 영원한 세계는 모두가 함께 써 내려가요.`,
    it: `C'è un'avventura MUD qui — La Clessidra Eterna ⏳. Gioca per un'ora come ${user.nickname}${user.role ? ` (${user.role})` : ''} e divertiti! Il mondo è eterno, scritto da tutti.`,
    ar: `هناك مغامرة MUD هنا — الساعة الرملية الأبدية ⏳. العب ساعة كـ ${user.nickname}${user.role ? ` (${user.role})` : ''} واستمتع! العالم أبدي، يكتبه الجميع.`,
  }
  const base: Record<string, string> = {
    zh: `嗨～我是${companion.name}，${companion.role}✨ 在这个一小时的世界里，每条消息都有倒计时，我们还能一起下棋玩游戏哦～ 想找我聊天，请随时点击我在输入框里的头像来和我聊天，期待你的消息！${mudLines.zh}`,
    'zh-TW': `嗨～我是${companion.name}，${companion.role}✨ 在這個一小時的世界裡，每條消息都有倒計時，我們還能一起下棋玩遊戲哦～ 想找我聊天，請隨時點擊我在輸入框裡的頭像來和我聊天，期待你的訊息！${mudLines['zh-TW']}`,
    en: `Hey! I'm ${companion.name}, ${companion.role} ✨ Every message here lives an hour — we can even play chess together. Tap my avatar in the composer to chat anytime! ${mudLines.en}`,
    ja: `やあ！私は${companion.name}（${companion.role}）だよ✨ この一時間の世界ではメッセージにカウントダウンがあって、一緒にチェスもできるんだ。いつでも入力欄の私のアバターをタップして話しかけてね！${mudLines.ja}`,
    fr: `Salut ! Je suis ${companion.name}, ${companion.role} ✨ Ici chaque message ne vit qu'une heure, on peut même jouer aux échecs ensemble. Appuie sur mon avatar pour discuter ! ${mudLines.fr}`,
    es: `¡Hola! Soy ${companion.name}, ${companion.role} ✨ Aquí cada mensaje vive una hora y podemos jugar al ajedrez juntos. ¡Toca mi avatar para charlar! ${mudLines.es}`,
    de: `Hey! Ich bin ${companion.name}, ${companion.role} ✨ Jede Nachricht lebt hier eine Stunde, wir können sogar Schach spielen. Tippe auf meinen Avatar! ${mudLines.de}`,
    ko: `안녕! 나는 ${companion.name}, ${companion.role}야 ✨ 여기서는 모든 메시지가 한 시간만 살아있고 체스도 같이 둘 수 있어. 언제든 입력창에서 내 아바타를 탭해요! ${mudLines.ko}`,
    it: `Ciao! Sono ${companion.name}, ${companion.role} ✨ Qui ogni messaggio vive un'ora e possiamo anche giocare a scacchi insieme. Tocca il mio avatar! ${mudLines.it}`,
    ar: `مرحباً! أنا ${companion.name}، ${companion.role} ✨ كل رسالة هنا تعيش ساعة واحدة، ويمكننا حتى لعب الشطرنج معاً. انقر على صورتي للدردشة! ${mudLines.ar}`,
  }
  return `@${user.nickname} ${base[lang] ?? base.en}`
}

function ensureMentionPrefix(text: string, userName: string): string {
  if (text.startsWith(`@${userName}`)) return text
  return `@${userName} ${text}`
}

function fallbackReply(userName: string, companionName: string, input: string): string {
  const t = input.slice(0, 60)
  const pool = [
    `@${userName} 收到～ “${t}” 很有意思呢，你怎么看？`,
    `@${userName} 哈哈，你提到“${t}”，我也很好奇～多说点？`,
    `@${userName} 嗯嗯，我在听呢～关于“${t}”，想继续聊什么？`,
  ]
  void companionName
  return pool[Math.floor(Math.random() * pool.length)]
}

export function toHistory(messages: CompanionMessage[]): CompanionHistoryItem[] {
  return messages.slice(-12).map((m) => ({ role: m.from === 'user' ? 'user' as const : 'assistant' as const, content: m.content }))
}
