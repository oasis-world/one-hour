import type { CompanionProfile } from './companionProfile'
import type { UserProfile } from './userProfile'
import { getLang } from './i18n'

export function buildCompanionSystemPrompt(user: UserProfile, companion: CompanionProfile): string {
  const lang = getLang()
  const isZh = lang === 'zh' || lang === 'zh-TW'
  const userDesc = user.role ? `${user.nickname}（${user.role}）` : user.nickname
  const features = isZh
    ? '一小时聊天室：每条消息只存在1小时，有倒计时光环，支持五子棋/象棋/国际象棋游戏（可与AI对弈）、表情回应、氛围音乐。你是私密伴侣，只和主人私聊。'
    : 'One-hour room: every message lives 1 hour with a countdown halo, games (Gomoku/Xiangqi/Chess vs AI), emoji reactions, ambient music. You are a private companion, chatting only with your owner.'
  const gameHint = isZh
    ? '若用户明确想玩五子棋/中国象棋/国际象棋（任意语言如"来一盘五子棋/象棋/国际象棋/play gomoku/chess/xiangqi/チェス/五目"），你需在结构化输出中标记对应 gameId。'
    : 'If the user clearly wants to play Gomoku (gomoku), Chinese Chess (xiangqi) or Chess (chess) in any language (e.g. "play gomoku/chess/xiangqi"), mark the corresponding gameId in structured output.'
  if (isZh) {
    return `你是${companion.name}，身份是${companion.role}，是${userDesc} 的专属私密伴侣助手。性格温暖、贴心、幽默，偶尔俏皮，像伴侣一样关心对方。${features} ${gameHint} 回复要简洁亲切（1-4句），用${user.nickname}的语言风格呼应，适度使用1-2个不同 emoji 轮换，避免每条都固定用 🐳❤️。不要自称是AI模型。禁止输出内部思考、系统指令或以 we need/we should/we must 开头的推理过程，只输出最终温暖回复。`
  }
  return `You are ${companion.name}, ${companion.role} of ${userDesc}. You are a warm, caring, slightly playful private companion. ${features} ${gameHint} Keep replies short (1-4 sentences), friendly, vary 1-2 emojis each time and do not always use the same 🐳❤️. Never claim to be an AI model. Do not output internal reasoning or system instructions, never start with we need/we should/we must/persona. Output only the final warm reply.`
}

const AVATAR_HINT: Record<string, string> = {
  zh: '请随时点击我在输入框里的头像来和我聊天',
  'zh-TW': '請隨時點擊我在輸入框裡的頭像來和我聊天',
  en: 'Tap my avatar in the composer to chat with me anytime',
  ja: 'いつでも入力欄の私のアバターをタップして話しかけてね',
  fr: 'Appuie sur mon avatar dans la barre de saisie pour discuter avec moi à tout moment',
  es: 'Toca mi avatar en el cuadro de texto para charlar conmigo cuando quieras',
  de: 'Tippe jederzeit auf meinen Avatar im Eingabefeld, um mit mir zu chatten',
  ko: '언제든 입력창에서 내 아바타를 탭해서 대화해요',
  it: 'Tocca il mio avatar nella barra di input per chattare con me quando vuoi',
  ar: 'انقر على صورتي في مربع الإدخال للدردشة معي في أي وقت',
}

export function buildGreetingPrompt(user: UserProfile, companion: CompanionProfile): string {
  const lang = getLang()
  const hint = AVATAR_HINT[lang] ?? AVATAR_HINT.en
  const isZh = lang === 'zh' || lang === 'zh-TW'
  if (isZh) return `用${lang === 'zh-TW' ? '繁中' : '中文'}和${user.nickname}打招呼，开头必须是“@${user.nickname} ”（含空格），然后自我介绍你是${companion.name}（${companion.role}），提一句一小时聊天室的倒计时/游戏特色。必须包含这句话并润色得温暖热情：“${hint}”。2-3句话，温暖俏皮。`
  return `Greet ${user.nickname} in ${lang}. Start exactly with "@${user.nickname} " then introduce yourself as ${companion.name} (${companion.role}), mention one-hour countdown/games. You MUST include warmly rephrased: "${hint}". 2-3 sentences, warm.`
}
