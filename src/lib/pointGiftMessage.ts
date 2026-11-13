import { getLang, LANGS, type Lang } from './i18n'

type GiftCopy = (recipient: string, points: number) => string

const COPY: Record<Lang, GiftCopy> = {
  zh: (name, points) => `🎁 @${name}，我送给你 ${points} 星星积分！去老虎机试试手气，或玩其他游戏、发送消息和照片继续赚积分。祝你玩得开心！`,
  'zh-TW': (name, points) => `🎁 @${name}，我送給你 ${points} 點星星積分！去老虎機試試手氣，或玩其他遊戲、傳送訊息和照片繼續賺取積分。祝你玩得開心！`,
  en: (name, points) => `🎁 @${name}, I gifted you ${points} star points! Try your luck at the slot machine, explore other games, or earn more by chatting and sharing photos. Have fun!`,
  ja: (name, points) => `🎁 @${name}さんにスター${points}ポイントを贈りました！スロットで運試しをしたり、ほかのゲームを遊んだり、メッセージや写真を共有してポイントを集めたりして楽しんでください！`,
  fr: (name, points) => `🎁 @${name}, je t’offre ${points} points étoile ! Tente ta chance à la machine à sous, découvre les autres jeux ou gagne-en davantage en discutant et en partageant des photos. Amuse-toi bien !`,
  es: (name, points) => `🎁 @${name}, te regalo ${points} puntos estrella. Prueba suerte en la tragaperras, descubre otros juegos o consigue más chateando y compartiendo fotos. ¡Que te diviertas!`,
  de: (name, points) => `🎁 @${name}, ich schenke dir ${points} Sternpunkte! Probiere den Spielautomaten aus, entdecke andere Spiele oder verdiene beim Chatten und Teilen von Fotos weitere Punkte. Viel Spaß!`,
  ko: (name, points) => `🎁 @${name}님께 별 포인트 ${points}점을 선물했어요! 슬롯머신에서 행운을 시험하거나 다른 게임을 즐기고, 메시지와 사진을 공유해 포인트를 더 모아 보세요. 즐겁게 플레이하세요!`,
  it: (name, points) => `🎁 @${name}, ti regalo ${points} punti stella! Prova la slot, scopri gli altri giochi o guadagna altri punti chattando e condividendo foto. Buon divertimento!`,
  ar: (name, points) => `🎁 @${name}، أهديك ${points} من نقاط النجوم! جرّب حظك في ماكينة الحظ، واكتشف الألعاب الأخرى، أو اكسب المزيد بالدردشة ومشاركة الصور. استمتع!`,
}

export function buildPointGiftMessage(recipient: string, points: number, preferredLang?: string | null): string {
  const lang = LANGS.includes(preferredLang as Lang) ? preferredLang as Lang : getLang()
  return COPY[lang](recipient, points)
}
