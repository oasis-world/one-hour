import { getLang, type Lang } from '../../lib/i18n'
import { pickLocalized, type Localized } from './localized'

type Dict = Record<string, string>

const DICTS: Record<Lang, Dict> = {
  zh: {
    'FIND YOUR FREQUENCY': '找到同频的人', 'One card · live all hour': '一张卡片 · 全场共玩一小时',
    ROUND: '第', 'VOTE NOW': '现在投票', 'REVEALING': '揭晓中', 'VOTING': '投票中',
    'Pick what feels like you — no right answer.': '选一个最像你的答案——没有对错。',
    votes: '票', 'You voted': '你选了', 'Change your vote': '改票',
    'You are the only one here so far': '目前只有你一个人在这里', 'waiting for the first vote…': '等待第一票…',
    'IN SYNC': '同频', 'people picked the same as you': '人和你想的一样', 'Say hi to': '打个招呼',
    'No one matched this round — next one!': '这轮没人同频——下轮再来！', 'Next round in': '下一轮',
    'Generating questions…': '正在生成题目…', 'Connecting to the room…': '正在连接房间…',
    'Offline · voting is unavailable': '离线 · 暂时无法投票', '+2 for joining': '参与 +2', 'Join the fun by voting': '投票即可参与',
    'VOTED_N_POINTS': '你已投，+2积分', 'Cancel change': '取消改票',
  },
  'zh-TW': {
    'FIND YOUR FREQUENCY': '找到同頻的人', 'One card · live all hour': '一張卡片 · 全場共玩一小時',
    ROUND: '第', 'VOTE NOW': '現在投票', REVEALING: '揭曉中', VOTING: '投票中',
    'Pick what feels like you — no right answer.': '選一個最像你的答案——沒有對錯。',
    votes: '票', 'You voted': '你選了', 'Change your vote': '改票',
    'You are the only one here so far': '目前只有你在這裡', 'waiting for the first vote…': '等待第一票…',
    'IN SYNC': '同頻', 'people picked the same as you': '人和你想的一樣', 'Say hi to': '打個招呼',
    'No one matched this round — next one!': '這輪沒人同頻——下輪再來！', 'Next round in': '下一輪',
    'Generating questions…': '正在產生題目…', 'Connecting to the room…': '正在連線房間…',
    'Offline · voting is unavailable': '離線 · 暫時無法投票', '+2 for joining': '參與 +2', 'Join the fun by voting': '投票即可參與',
    'VOTED_N_POINTS': '你已投，+2積分', 'Cancel change': '取消改票',
  },
  en: {
    'FIND YOUR FREQUENCY': 'FIND YOUR FREQUENCY', 'One card · live all hour': 'One card · live all hour',
    ROUND: 'ROUND', 'VOTE NOW': 'VOTE NOW', REVEALING: 'REVEALING', VOTING: 'VOTING',
    'Pick what feels like you — no right answer.': 'Pick what feels like you — no right answer.',
    votes: 'votes', 'You voted': 'You voted', 'Change your vote': 'Change your vote',
    'You are the only one here so far': 'You are the only one here so far', 'waiting for the first vote…': 'waiting for the first vote…',
    'IN SYNC': 'IN SYNC', 'people picked the same as you': 'people picked the same as you', 'Say hi to': 'Say hi to',
    'No one matched this round — next one!': 'No one matched this round — next one!', 'Next round in': 'Next round in',
    'Generating questions…': 'Generating questions…', 'Connecting to the room…': 'Connecting to the room…',
    'Offline · voting is unavailable': 'Offline · voting is unavailable', '+2 for joining': '+2 for joining', 'Join the fun by voting': 'Join the fun by voting',
    'VOTED_N_POINTS': 'Voted · +2 pts', 'Cancel change': 'Cancel change',
  },
  ja: {
    'FIND YOUR FREQUENCY': '波長の合う人を探そう', 'One card · live all hour': '一枚のカード · 1時間ずっと開幕中',
    ROUND: 'ラウンド', 'VOTE NOW': '投票する', REVEALING: '発表中', VOTING: '投票中',
    'Pick what feels like you — no right answer.': '自分らしい答えを選ぼう——正解はありません。',
    votes: '票', 'You voted': '投票済み', 'Change your vote': '投票を変更',
    'You are the only one here so far': '今はあなただけがここにいます', 'waiting for the first vote…': '最初の投票を待っています…',
    'IN SYNC': '同調', 'people picked the same as you': '人が同じ回答を選びました', 'Say hi to': '挨拶する',
    'No one matched this round — next one!': '今回は同調なし——次回！', 'Next round in': '次のラウンドまで',
    'Generating questions…': '問題を生成中…', 'Connecting to the room…': 'ルームに接続中…',
    'Offline · voting is unavailable': 'オフライン · 投票できません', '+2 for joining': '参加で +2', 'Join the fun by voting': '投票して参加しよう',
    'VOTED_N_POINTS': '投票済み · +2 ポイント', 'Cancel change': '変更を取り消す',
  },
  fr: {
    'FIND YOUR FREQUENCY': 'Trouvez votre fréquence', 'One card · live all hour': 'Une carte · en direct pendant une heure',
    ROUND: 'Manche', 'VOTE NOW': 'Voter', REVEALING: 'Révélation', VOTING: 'Vote en cours',
    'Pick what feels like you — no right answer.': 'Choisissez ce qui vous ressemble — pas de mauvaise réponse.',
    votes: 'votes', 'You voted': 'Vous avez voté', 'Change your vote': 'Changer de vote',
    'You are the only one here so far': 'Vous êtes le seul ici pour l’instant', 'waiting for the first vote…': 'En attente du premier vote…',
    'IN SYNC': 'En phase', 'people picked the same as you': 'personnes ont choisi comme vous', 'Say hi to': 'Dire bonjour à',
    'No one matched this round — next one!': 'Personne ne correspond ce tour — au suivant !', 'Next round in': 'Prochain tour dans',
    'Generating questions…': 'Génération des questions…', 'Connecting to the room…': 'Connexion à la salle…',
    'Offline · voting is unavailable': 'Hors ligne · vote indisponible', '+2 for joining': '+2 pour participer', 'Join the fun by voting': 'Participez en votant',
    'VOTED_N_POINTS': 'Vous avez voté · +2 pts', 'Cancel change': 'Annuler',
  },
  es: {
    'FIND YOUR FREQUENCY': 'Encuentra tu frecuencia', 'One card · live all hour': 'Una tarjeta · en vivo toda una hora',
    ROUND: 'Ronda', 'VOTE NOW': 'Votar ahora', REVEALING: 'Revelando', VOTING: 'Votando',
    'Pick what feels like you — no right answer.': 'Elige lo que más te represente — no hay respuesta incorrecta.',
    votes: 'votos', 'You voted': 'Has votado', 'Change your vote': 'Cambiar tu voto',
    'You are the only one here so far': 'Por ahora solo estás tú aquí', 'waiting for the first vote…': 'Esperando el primer voto…',
    'IN SYNC': 'En sintonía', 'people picked the same as you': 'personas eligieron lo mismo que tú', 'Say hi to': 'Saluda a',
    'No one matched this round — next one!': 'Nadie coincidió esta ronda — ¡la siguiente!', 'Next round in': 'Próxima ronda en',
    'Generating questions…': 'Generando preguntas…', 'Connecting to the room…': 'Conectando con la sala…',
    'Offline · voting is unavailable': 'Sin conexión · no se puede votar', '+2 for joining': '+2 por participar', 'Join the fun by voting': 'Únete votando',
    'VOTED_N_POINTS': 'Has votado · +2 pts', 'Cancel change': 'Cancelar',
  },
  de: {
    'FIND YOUR FREQUENCY': 'Finde deine Frequenz', 'One card · live all hour': 'Eine Karte · eine Stunde lang live',
    ROUND: 'Runde', 'VOTE NOW': 'Jetzt abstimmen', REVEALING: 'Auswertung', VOTING: 'Abstimmung läuft',
    'Pick what feels like you — no right answer.': 'Wähle, was zu dir passt — es gibt keine falsche Antwort.',
    votes: 'Stimmen', 'You voted': 'Du hast abgestimmt', 'Change your vote': 'Stimme ändern',
    'You are the only one here so far': 'Du bist bisher der Einzige hier', 'waiting for the first vote…': 'Warten auf die erste Stimme…',
    'IN SYNC': 'Im Einklang', 'people picked the same as you': 'Personen haben gleich gewählt', 'Say hi to': 'Sag Hallo zu',
    'No one matched this round — next one!': 'Diese Runde hat niemand getroffen — weiter!', 'Next round in': 'Nächste Runde in',
    'Generating questions…': 'Fragen werden generiert…', 'Connecting to the room…': 'Verbindung zum Raum…',
    'Offline · voting is unavailable': 'Offline · Abstimmen nicht möglich', '+2 for joining': '+2 fürs Mitmachen', 'Join the fun by voting': 'Mach mit und stimme ab',
    'VOTED_N_POINTS': 'Abgestimmt · +2 Punkte', 'Cancel change': 'Änderung abbrechen',
  },
  ko: {
    'FIND YOUR FREQUENCY': '같은 주파수 찾기', 'One card · live all hour': '한 장의 카드 · 한 시간 내내 라이브',
    ROUND: '라운드', 'VOTE NOW': '지금 투표', REVEALING: '결과 공개', VOTING: '투표 중',
    'Pick what feels like you — no right answer.': '나다운 답을 골라보세요 — 정답은 없어요.',
    votes: '표', 'You voted': '투표했어요', 'Change your vote': '투표 변경',
    'You are the only one here so far': '지금은 나만 여기 있어요', 'waiting for the first vote…': '첫 표를 기다리는 중…',
    'IN SYNC': '동기', 'people picked the same as you': '명이 나와 같은 선택을 했어요', 'Say hi to': '인사하기',
    'No one matched this round — next one!': '이번 라운드엔 아무도 안 맞았어요 — 다음에!', 'Next round in': '다음 라운드까지',
    'Generating questions…': '질문 생성 중…', 'Connecting to the room…': '방에 연결하는 중…',
    'Offline · voting is unavailable': '오프라인 · 투표할 수 없어요', '+2 for joining': '참여 시 +2', 'Join the fun by voting': '투표하고 참여하기',
    'VOTED_N_POINTS': '투표 완료 · +2점', 'Cancel change': '변경 취소',
  },
  it: {
    'FIND YOUR FREQUENCY': 'Trova la tua frequenza', 'One card · live all hour': 'Una carta · in diretta per un’ora',
    ROUND: 'Turno', 'VOTE NOW': 'Vota ora', REVEALING: 'Rivelazione', VOTING: 'Votazione in corso',
    'Pick what feels like you — no right answer.': 'Scegli ciò che ti somiglia — non c’è una risposta sbagliata.',
    votes: 'voti', 'You voted': 'Hai votato', 'Change your vote': 'Cambia voto',
    'You are the only one here so far': 'Per ora sei l’unico qui', 'waiting for the first vote…': 'In attesa del primo voto…',
    'IN SYNC': 'In sintonia', 'people picked the same as you': 'persone hanno scelto come te', 'Say hi to': 'Saluta',
    'No one matched this round — next one!': 'Nessuno ha scelto come te — al prossimo!', 'Next round in': 'Prossimo turno tra',
    'Generating questions…': 'Generazione delle domande…', 'Connecting to the room…': 'Connessione alla stanza…',
    'Offline · voting is unavailable': 'Offline · voto non disponibile', '+2 for joining': '+2 per partecipare', 'Join the fun by voting': 'Partecipa votando',
    'VOTED_N_POINTS': 'Votato · +2 punti', 'Cancel change': 'Annulla modifica',
  },
  ar: {
    'FIND YOUR FREQUENCY': 'اعثر على ترددك', 'One card · live all hour': 'بطاقة واحدة · مباشرة طوال ساعة',
    ROUND: 'الجولة', 'VOTE NOW': 'صوّت الآن', REVEALING: 'جارٍ الكشف', VOTING: 'جارٍ التصويت',
    'Pick what feels like you — no right answer.': 'اختر ما يشبهك — لا توجد إجابة خاطئة.',
    votes: 'أصوات', 'You voted': 'لقد صوّتت', 'Change your vote': 'غيّر تصويتك',
    'You are the only one here so far': 'أنت الوحيد هنا حتى الآن', 'waiting for the first vote…': 'بانتظار أول صوت…',
    'IN SYNC': 'على نفس الموجة', 'people picked the same as you': 'أشخاص اختاروا مثلك', 'Say hi to': 'قل مرحبًا لـ',
    'No one matched this round — next one!': 'لم يوافقك أحد هذه الجولة — الجولة التالية!', 'Next round in': 'الجولة التالية خلال',
    'Generating questions…': 'جارٍ توليد الأسئلة…', 'Connecting to the room…': 'جارٍ الاتصال بالغرفة…',
    'Offline · voting is unavailable': 'غير متصل · التصويت غير متاح', '+2 for joining': '+2 للمشاركة', 'Join the fun by voting': 'شارك بالتصويت',
    'VOTED_N_POINTS': 'تم التصويت · +2 نقطة', 'Cancel change': 'إلغاء التغيير',
  },
}

export function rt(key: string, lang: Lang = getLang()): string {
  return DICTS[lang]?.[key] ?? DICTS.en[key] ?? key
}

/** Pick the localized question/option text matching the viewer's language. */
export function questionText(lang: Lang, prompt: Localized): string {
  return pickLocalized(prompt, lang)
}
export function optionText(lang: Lang, label: Localized): string {
  return pickLocalized(label, lang)
}
