import { type Lang } from './i18n'

const STATS_KEY = 'one-hour-lifetime-stats'
const PENDING_KEY = 'one-hour-pending-summary'
const VAULT_STATS_KEY = 'one-hour-lifetime-stats-v'
const VAULT_PENDING_KEY = 'one-hour-pending-summary-v'

export interface LifetimeStats {
  messagesSent: number
  gomokuPlayed: number
  xiangqiPlayed: number
  wins: number
  losses: number
  interactions: Record<string, string>
}

export interface PendingSummary {
  stats: LifetimeStats
  profileExpiresAt: number | null
  startedAt: number
}

const EMPTY_STATS: LifetimeStats = {
  messagesSent: 0,
  gomokuPlayed: 0,
  xiangqiPlayed: 0,
  wins: 0,
  losses: 0,
  interactions: {},
}

function readStorage(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    // best effort
  }
}

function removeStorage(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key)
  } catch {
    // best effort
  }
}

function parseStats(raw: string | null): LifetimeStats {
  if (!raw) return { ...EMPTY_STATS, interactions: {} }
  try {
    const data = JSON.parse(raw) as Partial<LifetimeStats>
    return {
      messagesSent: typeof data.messagesSent === 'number' ? data.messagesSent : 0,
      gomokuPlayed: typeof data.gomokuPlayed === 'number' ? data.gomokuPlayed : 0,
      xiangqiPlayed: typeof data.xiangqiPlayed === 'number' ? data.xiangqiPlayed : 0,
      wins: typeof data.wins === 'number' ? data.wins : 0,
      losses: typeof data.losses === 'number' ? data.losses : 0,
      interactions:
        data.interactions && typeof data.interactions === 'object' ? (data.interactions as Record<string, string>) : {},
    }
  } catch {
    return { ...EMPTY_STATS, interactions: {} }
  }
}

export function loadStats(): LifetimeStats {
  let raw = readStorage(STATS_KEY)
  if (!raw) raw = readStorage(VAULT_STATS_KEY)
  if (raw) {
    writeStorage(STATS_KEY, raw)
    writeStorage(VAULT_STATS_KEY, raw)
  }
  return parseStats(raw)
}

export function saveStats(stats: LifetimeStats): void {
  const raw = JSON.stringify(stats)
  writeStorage(STATS_KEY, raw)
  writeStorage(VAULT_STATS_KEY, raw)
}

export function resetStats(): void {
  saveStats({ ...EMPTY_STATS, interactions: {} })
}

export function recordMessageSent(): void {
  const stats = loadStats()
  stats.messagesSent += 1
  saveStats(stats)
}

export function recordGameResult(
  gameType: 'gomoku' | 'xiangqi',
  selfId: string,
  winnerId: string | null,
  playerIds: string[],
): void {
  if (!playerIds.includes(selfId)) return
  const stats = loadStats()
  if (gameType === 'gomoku') stats.gomokuPlayed += 1
  else stats.xiangqiPlayed += 1
  if (winnerId && winnerId === selfId) stats.wins += 1
  else if (winnerId && winnerId !== selfId) stats.losses += 1
  saveStats(stats)
}

export function recordInteraction(userId: string, displayName: string, selfId?: string): void {
  if (!userId) return
  if (selfId && userId === selfId) return
  const stats = loadStats()
  stats.interactions[userId] = displayName
  saveStats(stats)
}

export function loadPendingSummary(): PendingSummary | null {
  let raw = readStorage(PENDING_KEY)
  if (!raw) raw = readStorage(VAULT_PENDING_KEY)
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as PendingSummary
    if (!data || typeof data.startedAt !== 'number') return null
    return data
  } catch {
    return null
  }
}

export function savePendingSummary(summary: PendingSummary): void {
  const raw = JSON.stringify(summary)
  writeStorage(PENDING_KEY, raw)
  writeStorage(VAULT_PENDING_KEY, raw)
}

export function clearPendingSummary(): void {
  removeStorage(PENDING_KEY)
  removeStorage(VAULT_PENDING_KEY)
}

export const FAREWELL_SENTENCES: Record<Lang, string[]> = {
  zh: [
    '愿你前路有光，心有所向。',
    '再见，愿你被世界温柔以待。',
    '一小时的相遇，一生的祝福。',
    '祝你旅程顺利，笑容常在。',
    '带着温暖继续前行吧。',
    '愿所有美好都与你同行。',
    '再见，愿你心安且自由。',
    '一小时虽短，友谊长存。',
    '愿你所遇皆温柔，所行皆坦途。',
    '带着今天的快乐继续旅程。',
    '再见，愿你被幸运眷顾。',
    '愿前路平坦，心情晴朗。',
    '一小时的陪伴，永远的祝福。',
    '愿你找到属于自己的光。',
    '再见，愿你勇敢前行。',
    '愿所有的努力都有回响。',
    '一小时的时光，化作永恒的祝福。',
    '愿你永远保持微笑与好奇。',
    '再见，愿你梦想成真。',
    '愿你被爱包围，心怀希望。',
  ],
  'zh-TW': [
    '願你前路有光，心有所向。',
    '再見，願你被世界溫柔以待。',
    '一小時的相遇，一生的祝福。',
    '祝你旅程順利，笑容常在。',
    '帶著溫暖繼續前行吧。',
    '願所有美好都與你同行。',
    '再見，願你心安且自由。',
    '一小時雖短，友誼長存。',
    '願你所遇皆溫柔，所行皆坦途。',
    '帶著今天的快樂繼續旅程。',
    '再見，願你被幸運眷顧。',
    '願前路平坦，心情晴朗。',
    '一小時的陪伴，永遠的祝福。',
    '願你找到屬於自己的光。',
    '再見，願你勇敢前行。',
    '願所有的努力都有回響。',
    '一小時的時光，化作永恆的祝福。',
    '願你永遠保持微笑與好奇。',
    '再見，願你夢想成真。',
    '願你被愛包圍，心懷希望。',
  ],
  en: [
    'May your path ahead be bright.',
    'Goodbye — may the world be gentle to you.',
    'An hour of meeting, a lifetime of blessings.',
    'Wishing you a smooth journey and a smiling heart.',
    'Carry this warmth forward on your way.',
    'May all good things travel with you.',
    'Goodbye — may you be at peace and free.',
    'An hour is short, friendship endures.',
    'May you meet kindness and walk easy roads.',
    'Take today’s joy with you on the journey.',
    'Goodbye — may luck be on your side.',
    'May the road be flat and your mood sunny.',
    'An hour of company, a lifetime of blessings.',
    'May you find your own light.',
    'Goodbye — may you be brave and go forward.',
    'May every effort echo back.',
    'An hour of time becomes an eternal blessing.',
    'May you always keep smiling and curious.',
    'Goodbye — may your dreams come true.',
    'May you be surrounded by love and hope.',
  ],
  ja: [
    '前路に光がありますように。',
    'さようなら、世界があなたに優しくありますように。',
    '一時間の出会い、一生の祝福。',
    '旅路が順調で、笑顔が絶えませんように。',
    '温もりを持って、前へ進んでください。',
    'すべての良いことがあなたと共にありますように。',
    'さようなら、心安らかで自由でありますように。',
    '一時間は短い、友情は長く続きます。',
    '優しさに出会い、平坦な道を歩けますように。',
    '今日の喜びを旅に持ち帰ってください。',
    'さようなら、幸運があなたに訪れますように。',
    '前路が平らで、心が晴れますように。',
    '一時間の伴走、永遠の祝福。',
    '自分だけの光を見つけられますように。',
    'さようなら、勇気をもって前へ。',
    'すべての努力が響き合いますように。',
    '一時間の時間が永遠の祝福となりますように。',
    'いつも笑顔と好奇心を持ち続けてください。',
    'さようなら、夢が叶いますように。',
    '愛に包まれ、希望を胸に。',
  ],
  fr: [
    'Que votre chemin soit lumineux.',
    'Au revoir — que le monde vous soit doux.',
    'Une heure de rencontre, une vie de bénédictions.',
    'Je vous souhaite un beau voyage et un cœur souriant.',
    'Portez cette chaleur avec vous.',
    'Que tout le bien vous accompagne.',
    'Au revoir — que vous soyez en paix et libre.',
    'Une heure est courte, l’amitié dure.',
    'Que vous rencontriez la douceur et des chemins faciles.',
    'Emportez la joie d’aujourd’hui dans votre voyage.',
    'Au revoir — que la chance vous sourie.',
    'Que la route soit plate et l’humeur ensoleillée.',
    'Une heure de compagnie, une vie de bénédictions.',
    'Puissiez-vous trouver votre propre lumière.',
    'Au revoir — soyez courageux et avancez.',
    'Que chaque effort trouve un écho.',
    'Une heure de temps devient une bénédiction éternelle.',
    'Gardez toujours le sourire et la curiosité.',
    'Au revoir — que vos rêves se réalisent.',
    'Puissiez-vous être entouré d’amour et d’espoir.',
  ],
  es: [
    'Que tu camino esté lleno de luz.',
    'Adiós — que el mundo sea amable contigo.',
    'Una hora de encuentro, una vida de bendiciones.',
    'Te deseo un viaje tranquilo y un corazón sonriente.',
    'Lleva este calor contigo.',
    'Que todo lo bueno te acompañe.',
    'Adiós — que estés en paz y seas libre.',
    'Una hora es corta, la amistad perdura.',
    'Que encuentres amabilidad y caminos fáciles.',
    'Lleva la alegría de hoy en tu viaje.',
    'Adiós — que la suerte te acompañe.',
    'Que el camino sea llano y tu ánimo soleado.',
    'Una hora de compañía, una vida de bendiciones.',
    'Que encuentres tu propia luz.',
    'Adiós — sé valiente y sigue adelante.',
    'Que cada esfuerzo tenga eco.',
    'Una hora de tiempo se vuelve una bendición eterna.',
    'Que siempre conserves la sonrisa y la curiosidad.',
    'Adiós — que tus sueños se hagan realidad.',
    'Que te rodeen el amor y la esperanza.',
  ],
  de: [
    'Möge dein Weg hell sein.',
    'Auf Wiedersehen — möge die Welt dir sanft sein.',
    'Eine Stunde Begegnung, ein Leben voller Segen.',
    'Ich wünsche dir eine gute Reise und ein lächelndes Herz.',
    'Trage diese Wärme mit dir weiter.',
    'Möge alles Gute dich begleiten.',
    'Auf Wiedersehen — mögest du in Frieden und frei sein.',
    'Eine Stunde ist kurz, Freundschaft währt.',
    'Mögest du Güte begegnen und leichte Wege gehen.',
    'Nimm die Freude von heute mit auf die Reise.',
    'Auf Wiedersehen — möge das Glück mit dir sein.',
    'Möge die Straße eben und deine Stimmung sonnig sein.',
    'Eine Stunde Gesellschaft, ein Leben voller Segen.',
    'Mögest du dein eigenes Licht finden.',
    'Auf Wiedersehen — sei mutig und geh voran.',
    'Möge jede Anstrengung widerhallen.',
    'Eine Stunde Zeit wird zu einem ewigen Segen.',
    'Mögest du immer lächeln und neugierig bleiben.',
    'Auf Wiedersehen — mögen deine Träume wahr werden.',
    'Mögest du von Liebe und Hoffnung umgeben sein.',
  ],
  ko: [
    '앞길에 빛이 있기를.',
    '안녕, 세상이 당신에게 부드럽기를.',
    '한 시간의 만남, 평생의 축복.',
    '여정이 순탄하고 마음이 웃기를.',
    '이 따뜻함을 가지고 계속 가세요.',
    '모든 좋은 것이 당신과 함께하길.',
    '안녕, 평안하고 자유로우시길.',
    '한 시간은 짧지만 우정은 오래갑니다.',
    '친절을 만나고 평탄한 길을 걷기를.',
    '오늘의 기쁨을 여행에 가져가세요.',
    '안녕, 행운이 당신 편이기를.',
    '길이 평탄하고 마음이 화창하기를.',
    '한 시간의 동행, 평생의 축복.',
    '자신만의 빛을 찾기를.',
    '안녕, 용기 내어 앞으로 나아가세요.',
    '모든 노력이 메아리치기를.',
    '한 시간의 시간이 영원한 축복이 되기를.',
    '언제나 미소와 호기심을 지니기를.',
    '안녕, 꿈이 이루어지기를.',
    '사랑과 희망에 둘러싸이기를.',
  ],
  it: [
    'Che il tuo cammino sia luminoso.',
    'Addio — che il mondo sia gentile con te.',
    'Un’ora di incontro, una vita di benedizioni.',
    'Ti auguro un viaggio sereno e un cuore sorridente.',
    'Porta con te questo calore.',
    'Che ogni bene ti accompagni.',
    'Addio — che tu sia in pace e libero.',
    'Un’ora è breve, l’amicizia dura.',
    'Che tu incontri gentilezza e strade facili.',
    'Porta la gioia di oggi nel tuo viaggio.',
    'Addio — che la fortuna ti assista.',
    'Che la strada sia piana e l’umore soleggiato.',
    'Un’ora di compagnia, una vita di benedizioni.',
    'Che tu trovi la tua luce.',
    'Addio — sii coraggioso e vai avanti.',
    'Che ogni sforzo abbia eco.',
    'Un’ora di tempo diventa una benedizione eterna.',
    'Che tu sorrida sempre e resti curioso.',
    'Addio — che i tuoi sogni si avverino.',
    'Che tu sia circondato da amore e speranza.',
  ],
  ar: [
    'ليكن طريقك مشرقاً.',
    'وداعاً — ليكن العالم لطيفاً معك.',
    'ساعة من لقاء، عمر من بركات.',
    'أتمنى لك رحلة سلسة وقلباً مبتسماً.',
    'احمل هذا الدفء معك.',
    'لِيَكُنْ كلُّ خيرٍ معك.',
    'وداعاً — لتكن في سلام وحرية.',
    'ساعة قصيرة، والصداقة تدوم.',
    'لتلتقِ باللطف وتمشي في طرق سهلة.',
    'خذ فرحة اليوم معك في رحلتك.',
    'وداعاً — ليكن الحظ إلى جانبك.',
    'ليكن الطريق مسطحاً والمزاج مشمساً.',
    'ساعة من الصحبة، عمر من بركات.',
    'لتجد نورك الخاص.',
    'وداعاً — كن شجاعاً وتقدم.',
    'لي صدىً لكل جهد.',
    'ساعة من الوقت تصبح بركة أبدية.',
    'لتبسم دائماً وتبقَ فضولياً.',
    'وداعاً — لتتحقق أحلامك.',
    'لتكن محاطاً بالحب والأمل.',
  ],
}