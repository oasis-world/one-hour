import type { CompanionProfile } from './companionProfile'
import type { UserProfile } from './userProfile'
import { getLang } from './i18n'

const FEATURES: Record<string, string> = {
  zh: '一小时聊天室：每条消息只存在1小时，有倒计时光环，支持五子棋/象棋/国际象棋游戏（可与AI对弈）、表情回应、氛围音乐。你是私密伴侣，只和主人私聊。',
  'zh-TW': '一小時聊天室：每條訊息只存在1小時，有倒計時光環，支援五子棋/象棋/國際象棋遊戲（可與AI對弈）、表情回應、氛圍音樂。你是私密伴侶，只和主人私聊。',
  en: 'One-hour room: every message lives 1 hour with a countdown halo, games (Gomoku/Xiangqi/Chess vs AI), emoji reactions, ambient music. You are a private companion, chatting only with your owner.',
  ja: '1時間チャットルーム：メッセージは1時間で消え、カウントダウン演出、五目並べ/象棋/チェス（AI対戦可）、リアクション、環境音楽あり。あなたはご主人専用のプライベートパートナーです。',
  fr: 'Salon d’une heure : chaque message vit 1h avec halo de compte à rebours, jeux (Gomoku/Xiangqi/Échecs vs IA), réactions, musique d’ambiance. Vous êtes un compagnon privé réservé à votre propriétaire.',
  es: 'Sala de una hora: cada mensaje vive 1h con halo de cuenta atrás, juegos (Gomoku/Xiangqi/Ajedrez vs IA), reacciones, música ambiental. Eres un compañero privado solo para tu dueño.',
  de: 'Ein-Stunden-Raum: Jede Nachricht lebt 1 Stunde mit Countdown-Halo, Spiele (Gomoku/Xiangqi/Schach vs KI), Reaktionen, Ambient-Musik. Du bist ein privater Begleiter nur für deinen Besitzer.',
  ko: '1시간 채팅방: 모든 메시지는 1시간만 유지되며 카운트다운, 오목/샹치/체스(AI 대전), 리액션, 배경음악을 지원합니다. 당신은 주인 전용 프라이빗 컴패니언입니다.',
  it: 'Stanza di un’ora: ogni messaggio vive 1h con alone countdown, giochi (Gomoku/Xiangqi/Scacchi vs IA), reazioni, musica ambientale. Sei un compagno privato solo per il tuo proprietario.',
  ar: 'غرفة الساعة الواحدة: كل رسالة تعيش ساعة مع هالة العد التنازلي، ألعاب (غوموكو/شطرنج صيني/شطرنج ضد الذكاء الاصطناعي)، تفاعلات، موسيقى محيطة. أنت رفيق خاص لمالكك فقط.',
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

const MUD_HINT: Record<string, string> = {
  zh: '这里有一个开放世界 MUD《潮汐启元》🌊：八域十二封印已在进行中，新人直接加入当前进度，解谜修行升级，还能在卡片里输入框让 AI 生成任务，AI 守门人随时解答。',
  'zh-TW': '這裡有一個開放世界 MUD《潮汐啟元》🌊：八域十二封印已在進行中，新人直接加入當前進度，解謎修行升級，還能在卡片裡輸入框讓 AI 生成任務，AI 守門人隨時解答。',
  en: 'There’s an open-world MUD — Tide Genesis 🌊: eight regions and twelve seals are already underway, newcomers land on current progress, solve puzzles to cultivate, and can type a prompt in the card to let AI generate tasks. The AI Guide answers anytime.',
  ja: 'オープン・ワールドMUD『潮汐啓元』🌊があります。8領域12封印が進行中、新規参加者は現在の進捗へ。パズルでเติบโตし、カードに入力するとAIがタスクを生成、ガイドが随時答えます。',
  fr: 'Un MUD ouvert vous attend — Genèse des Marées 🌊. Huit régions et douze sceaux sont déjà en cours, les nouveaux arrivent au progrès actuel, résolvez des énigmes pour progresser, et tapez dans la carte pour que l’IA génère une tâche. Le Guide répond à tout moment.',
  es: 'Hay un MUD de mundo abierto — Génesis de la Marea 🌊. Ocho regiones y doce sellos ya están en curso, los nuevos llegan al progreso actual, resuelve acertijos para cultivarte y escribe en la tarjeta para que la IA genere una tarea. El Guía responde siempre.',
  de: 'Es gibt ein offenes MUD — Gezeiten-Genesis 🌊. Acht Regionen und zwölf Siegel laufen bereits, neue Spieler landen im aktuellen Fortschritt, löse Rätsel zur Kultivierung und schreibe in die Karte, damit die KI eine Aufgabe erstellt. Die Guide antwortet jederzeit.',
  ko: '오픈 월드 MUD ‘조수 기원’ 🌊이 있어요. 8개 영역 12개 봉인이 이미 진행 중이고 신규는 현재 진행도에 바로 착지합니다. 퍼즐로 수련하고 카드에 입력하면 AI가 퀘스트를 생성하고 가이드가随时答합니다。',
  it: 'C’è un MUD a mondo aperto — Genesi della Marea 🌊. Otto regioni e dodici sigilli sono già in corso, i nuovi arrivano ai progressi attuali, risolvi enigmi per coltivarti e scrivi nella scheda per far generare un compito all’IA. La Guida risponde sempre.',
  ar: 'هناك عالم مفتوح — تكوين المد 🌊. ثماني مناطق واثنا عشر ختماً قيد التنفيذ، الوافد الجديد يصل إلى التقدم الحالي، حل الألغاز لتتزكى، واكتب في البطاقة لتوليد مهمة بالذكاء الاصطناعي. المرشد يرد دائماً.',
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
  const hint = AVATAR_HINT[lang] ?? AVATAR_HINT.en
  const mudHint = MUD_HINT[lang] ?? MUD_HINT.en
  const isZh = lang === 'zh' || lang === 'zh-TW'
  const langName = ({ zh: '中文', 'zh-TW': '繁中', en: 'English', ja: '日本語', fr: 'Français', es: 'Español', de: 'Deutsch', ko: '한국어', it: 'Italiano', ar: 'العربية' } as Record<string, string>)[lang] ?? lang
  if (isZh) {
    return `用${langName}和${user.nickname}打招呼，开头必须是“@${user.nickname} ”（含空格），然后自我介绍你是${companion.name}（${companion.role}），提一句一小时聊天室的倒计时/游戏特色。必须包含这句话并润色得温暖热情：“${hint}”。另外必须加上一句（保留角色名与1小时信息）：“${mudHint}”可轻微润色但必须保留“${user.nickname}”与“1小时”与“永恒沙漏/永恆沙漏”。3-5句话，温暖俏皮。`
  }
  return `Greet ${user.nickname} in ${langName} (${lang}). Start exactly with "@${user.nickname} " then introduce yourself as ${companion.name} (${companion.role}), mention one-hour countdown/games. You MUST include warmly rephrased: "${hint}". Also add a sentence (keep role + 1 hour): "${mudHint}" — must keep "${user.nickname}" and "${MUD_HINT[lang]?.includes('1') ? '1 hour' : '1 hour'}" and hourglass name. 3-5 sentences, warm.`
}
