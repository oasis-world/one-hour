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
  if (!user) return `@${companion.name} 你好呀！我是你的伙伴，随时@我聊天吧～`
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
  const base: Record<string, string> = {
    zh: `嗨～我是${companion.name}，${companion.role}✨ 这里的消息一小时后就会消失。想玩游戏，点输入框旁的游戏按钮；想找我聊天，输入 @ 就能找到我～`,
    'zh-TW': `嗨～我是${companion.name}，${companion.role}✨ 這裡的訊息一小時後就會消失。想玩遊戲，點輸入框旁的遊戲按鈕；想找我聊天，輸入 @ 就能找到我～`,
    en: `Hey! I'm ${companion.name}, ${companion.role} ✨ Messages here disappear after an hour. Tap the game button beside the composer to pick a game, or type @ to find me and chat!`,
    ja: `やあ！私は${companion.name}（${companion.role}）だよ✨ メッセージは一時間で消えるんだ。ゲームは入力欄の横のボタンから選んでね。おしゃべりするときは「@」を入力して私を見つけてね！`,
    fr: `Salut ! Je suis ${companion.name}, ${companion.role} ✨ Les messages disparaissent au bout d'une heure. Appuie sur le bouton des jeux pour en choisir un, ou tape @ pour me trouver et discuter !`,
    es: `¡Hola! Soy ${companion.name}, ${companion.role} ✨ Los mensajes desaparecen después de una hora. Toca el botón de juegos para elegir uno, o escribe @ para encontrarme y charlar.`,
    de: `Hey! Ich bin ${companion.name}, ${companion.role} ✨ Nachrichten verschwinden nach einer Stunde. Wähle über die Spieleschaltfläche ein Spiel aus oder gib @ ein, um mich zum Chatten zu finden!`,
    ko: `안녕! 나는 ${companion.name}, ${companion.role}야 ✨ 메시지는 한 시간 뒤 사라져. 게임 버튼을 눌러 게임을 고르고, 대화하고 싶을 땐 @를 입력해 나를 찾아줘!`,
    it: `Ciao! Sono ${companion.name}, ${companion.role} ✨ I messaggi scompaiono dopo un'ora. Tocca il pulsante dei giochi per sceglierne uno, oppure scrivi @ per trovarmi e chattare!`,
    ar: `مرحباً! أنا ${companion.name}، ${companion.role} ✨ تختفي الرسائل بعد ساعة. اضغط زر الألعاب لاختيار لعبة، أو اكتب @ لتجدني وتتحدث معي!`,
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
