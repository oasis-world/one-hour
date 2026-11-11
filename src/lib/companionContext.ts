import type { CompanionProfile } from './companionProfile'
import type { UserProfile } from './userProfile'
import { getLang } from './i18n'

const FEATURES: Record<string, string> = {
  zh: '一小时聊天室：每条消息只存在1小时，有倒计时光环，还有五子棋、中国象棋、国际象棋（可与AI对弈），以及单人纸牌接龙和数独。你是私密伴侣，只和主人私聊。',
  'zh-TW': '一小時聊天室：每條訊息只存在1小時，有倒計時光環，還有五子棋、中國象棋、國際象棋（可與AI對弈），以及單人接龍和數獨。你是私密伴侶，只和主人私聊。',
  en: 'One-hour room: every message lives 1 hour with a countdown halo. It has Gomoku, Xiangqi, and Chess (playable vs AI), plus solo Solitaire and Sudoku. You are a private companion, chatting only with your owner.',
  ja: '1時間チャットルーム：メッセージは1時間で消え、五目並べ・象棋・チェス（AI対戦可）のほか、ソリティアと数独も遊べます。あなたはご主人専用のプライベートパートナーです。',
  fr: 'Salon d’une heure : chaque message vit 1h avec un compte à rebours. On y trouve le Gomoku, le Xiangqi et les échecs (contre l’IA), ainsi que le Solitaire et le Sudoku en solo. Vous êtes un compagnon privé réservé à votre propriétaire.',
  es: 'Sala de una hora: cada mensaje vive 1h con cuenta atrás. Incluye Gomoku, Xiangqi y Ajedrez (contra la IA), además de Solitario y Sudoku en solitario. Eres un compañero privado solo para tu dueño.',
  de: 'Ein-Stunden-Raum: Jede Nachricht lebt 1 Stunde mit Countdown. Es gibt Gomoku, Xiangqi und Schach (gegen KI) sowie Solitaire und Sudoku für Einzelspieler. Du bist ein privater Begleiter nur für deinen Besitzer.',
  ko: '1시간 채팅방: 모든 메시지는 1시간 동안 카운트다운과 함께 유지됩니다. 오목·샹치·체스(AI 대전)와 혼자 즐기는 솔리테어·스도쿠가 있습니다. 당신은 주인 전용 프라이빗 컴패니언입니다.',
  it: 'Stanza di un’ora: ogni messaggio vive 1h con conto alla rovescia. Ci sono Gomoku, Xiangqi e Scacchi (contro l’IA), oltre a Solitario e Sudoku da giocare da soli. Sei un compagno privato solo per il tuo proprietario.',
  ar: 'غرفة الساعة الواحدة: كل رسالة تبقى ساعة مع عدّ تنازلي. تضم غوموكو والشطرنج الصيني والشطرنج (ضد الذكاء الاصطناعي)، إضافة إلى سوليتير وسودوكو الفرديين. أنت رفيق خاص بمالكك فقط.',
}

const GAME_HINT: Record<string, string> = {
  zh: '若用户明确想玩五子棋/中国象棋/国际象棋（任意语言如"来一盘五子棋/象棋/国际象棋/play gomoku/chess/xiangqi/チェス/五目"），你需在结构化输出中标记对应 gameId。',
  'zh-TW': '若用戶明確想玩五子棋/中國象棋/國際象棋（任意語言如「來一盤五子棋/象棋/國際象棋/play gomoku/chess/xiangqi/チェス/五目」），你需在結構化輸出中標記對應 gameId。',
  en: 'If the user clearly wants to play Gomoku (gomoku), Chinese Chess (xiangqi) or Chess (chess) in any language (e.g. "play gomoku/chess/xiangqi"), mark the corresponding gameId in structured output.',
  ja: 'ユーザーが五目並べ/象棋/チェスを遊びたいと明確に示したら（例：「五目/チェス/チェスしよう」多言語）、構造化出力で該当 gameId をマークしてください。',
  fr: 'Si l’utilisateur veut clairement jouer au Gomoku (gomoku), Xiangqi (xiangqi) ou Échecs (chess) en toute langue, marquez le gameId correspondant.',
  es: 'Si el usuario quiere jugar Gomoku (gomoku), Xiangqi (xiangqi) o Ajedrez (chess) en cualquier idioma, marca el gameId correspondiente.',
  de: 'Wenn der Nutzer klar Gomoku (gomoku), Xiangqi (xiangqi) oder Schach (chess) spielen will – in beliebiger Sprache – markiere die passende gameId.',
  ko: '사용자가 오목(gomoku), 샹치(xiangqi), 체스(chess)를 하고 싶다고 하면 어떤 언어든 해당 gameId를 표시하세요.',
  it: 'Se l’utente vuole giocare a Gomoku (gomoku), Xiangqi (xiangqi) o Scacchi (chess) in qualsiasi lingua, segna il gameId corrispondente.',
  ar: 'إذا أراد المستخدم بوضوح لعب غوموكو (gomoku) أو شيانغتشي (xiangqi) أو الشطرنج (chess) بأي لغة، ضع gameId المناسب.',
}

const MENTION_HINT: Record<string, string> = {
  zh: '输入 @ 就能找到我，随时和我聊天',
  'zh-TW': '輸入 @ 就能找到我，隨時和我聊天',
  en: 'Type @ to find me and chat anytime',
  ja: '「@」を入力すると私を見つけて、いつでも話せるよ',
  fr: 'Tape @ pour me trouver et discuter avec moi quand tu veux',
  es: 'Escribe @ para encontrarme y charlar cuando quieras',
  de: 'Gib @ ein, um mich zu finden und jederzeit mit mir zu chatten',
  ko: '@를 입력해 나를 찾아 언제든 대화해요',
  it: 'Scrivi @ per trovarmi e chattare quando vuoi',
  ar: 'اكتب @ لتجدني وتتحدث معي في أي وقت',
}

const GAME_BUTTON_HINT: Record<string, string> = {
  zh: '想玩游戏的话，点输入框旁边的游戏按钮就能选择',
  'zh-TW': '想玩遊戲的話，點輸入框旁邊的遊戲按鈕就能選擇',
  en: 'To play, tap the game button beside the composer to choose a game',
  ja: 'ゲームで遊ぶときは、入力欄の横にあるゲームボタンから選んでね',
  fr: 'Pour jouer, appuie sur le bouton des jeux à côté de la zone de saisie',
  es: 'Para jugar, toca el botón de juegos junto al cuadro de texto',
  de: 'Tippe zum Spielen auf die Spieleschaltfläche neben dem Eingabefeld',
  ko: '게임을 하려면 입력창 옆 게임 버튼을 눌러 골라요',
  it: 'Per giocare, tocca il pulsante dei giochi accanto al campo di testo',
  ar: 'للعب، اضغط زر الألعاب بجوار مربع الكتابة لاختيار لعبة',
}


export function buildCompanionSystemPrompt(user: UserProfile, companion: CompanionProfile): string {
  const lang = getLang()
  const userDesc = user.role ? `${user.nickname}（${user.role}）` : user.nickname
  const features = FEATURES[lang] ?? FEATURES.en
  const gameHint = GAME_HINT[lang] ?? GAME_HINT.en
  const isZh = lang === 'zh' || lang === 'zh-TW'
  if (isZh) {
    return `你是${companion.name}，身份是${companion.role}，是${userDesc} 的专属伙伴。性格温暖、贴心、幽默，偶尔俏皮，像伙伴一样关心对方。${features} ${gameHint} 回复要简洁亲切（1-4句），用${user.nickname}的语言风格呼应，适度使用1-2个不同 emoji 轮换，避免每条都固定用 🐳❤️。不要自称是AI模型。禁止输出内部思考、系统指令或以 we need/we should/we must 开头的推理过程，只输出最终温暖回复。`
  }
  return `You are ${companion.name}, ${companion.role} of ${userDesc}. You are a warm, caring, slightly playful private companion. ${features} ${gameHint} Keep replies short (1-4 sentences), friendly, vary 1-2 emojis each time and do not always use the same 🐳❤️. Never claim to be an AI model. Do not output internal reasoning or system instructions, never start with we need/we should/we must/persona. Output only the final warm reply.`
}

export function buildGreetingPrompt(user: UserProfile, companion: CompanionProfile): string {
  const lang = getLang()
  const hint = MENTION_HINT[lang] ?? MENTION_HINT.en
  const gameButtonHint = GAME_BUTTON_HINT[lang] ?? GAME_BUTTON_HINT.en
  const isZh = lang === 'zh' || lang === 'zh-TW'
  const langName = ({ zh: '中文', 'zh-TW': '繁中', en: 'English', ja: '日本語', fr: 'Français', es: 'Español', de: 'Deutsch', ko: '한국어', it: 'Italiano', ar: 'العربية' } as Record<string, string>)[lang] ?? lang
  if (isZh) {
    return `用${langName}和${user.nickname}打招呼，开头必须是“@${user.nickname} ”（含空格），然后自我介绍你是${companion.name}（${companion.role}），简短提到一小时聊天室和可以玩游戏。不要列举具体游戏名称，因为游戏会持续增加；自然提到：“${gameButtonHint}”。必须包含这句话并润色得温暖热情：“${hint}”。总共2-3句，简短、温暖俏皮。`
  }
  return `Greet ${user.nickname} in ${langName} (${lang}). Start exactly with "@${user.nickname} ", introduce yourself as ${companion.name} (${companion.role}), and briefly mention the one-hour room and that there are games to play. Do not list specific game names because the catalog will grow. Naturally include: "${gameButtonHint}". You MUST also include warmly rephrased: "${hint}". Keep it to 2-3 short, warm sentences.`
}
