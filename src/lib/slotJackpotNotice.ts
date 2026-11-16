import { getLang, LANGS, type Lang } from './i18n'

export interface JackpotNoticeWinner {
  name: string
  amount: number
}

type NoticeCopy = (total: number, list: string, extra: string) => string

const COPY: Record<Lang, NoticeCopy> = {
  zh: (total, list, extra) => `🎊 老虎机奖池开奖啦！本期奖池共 ${total} 积分，随机撒给了 ${list}。${extra}感谢每一位的手气加持，下一把好运继续旺起来！`,
  'zh-TW': (total, list, extra) => `🎊 老虎機獎池開獎啦！本期獎池共 ${total} 積分，隨機撒給了 ${list}。${extra}感謝每一位的手氣加持，下一把好運繼續旺起來！`,
  en: (total, list, extra) => `🎊 The slot jackpot just dropped! This round's ${total} points went to ${list}. ${extra}Thanks for bringing the luck — keep those reels spinning!`,
  ja: (total, list, extra) => `🎊 スロットのジャックポット開けました！今期の ${total} ポイントが ${list} にランダムで配られました。${extra}みんなの幸運に感謝！次のスピンも運気アップ！`,
  fr: (total, list, extra) => `🎊 Le jackpot de la machine à sous vient de tomber ! Les ${total} points de cette fois ont été distribués à ${list}. ${extra}Merci à tout le monde pour la chance — que les rouleaux continuent de tourner !`,
  es: (total, list, extra) => `🎊 ¡Ya cayó el bote de la tragaperras! Los ${total} puntos de esta ronda fueron para ${list}. ${extra}¡Gracias por la suerte que compartieron, que siga girando!`,
  de: (total, list, extra) => `🎊 Der Slot-Jackpot wurde geknackt! Die ${total} Punkte dieser Runde gingen an ${list}. ${extra}Danke für euer Glück — weiter drehen und gewinnen!`,
  ko: (total, list, extra) => `🎊 슬롯머신 잭팟이 터졌어요! 이번 회차 ${total}포인트가 ${list}에게 랜덤으로 나눠졌어요. ${extra}모두의 행운에 감사해요, 다음 스핀도 대박 나길!`,
  it: (total, list, extra) => `🎊 È caduto il jackpot della slot! I ${total} punti di questo giro sono andati a ${list}. ${extra}Grazie a tutti per la fortuna — continuate a girare!`,
  ar: (total, list, extra) => `🎊 سقطت جائزة ماكينة الحظ! نقاط هذه الجولة البالغة ${total} ذهبت إلى ${list}. ${extra}شكراً للجميع على الحظ — استمروا في الدوران!`,
}

const MAX_NAMES = 10

/** Names are written as @name so the chat renderer shows them blue & bold. */
export function buildSlotJackpotNotice(winners: JackpotNoticeWinner[], total: number, preferredLang?: string | null): string {
  const lang = LANGS.includes(preferredLang as Lang) ? preferredLang as Lang : getLang()
  const shown = winners.slice(0, MAX_NAMES)
  const list = shown.map((winner) => `@${winner.name} +${winner.amount}`).join('、')
  const hidden = winners.length - shown.length
  const extra = hidden > 0
    ? (lang === 'zh' || lang === 'zh-TW' ? `还有 ${hidden} 位玩家也拿到了积分，` : `+${hidden} more — `)
    : ''
  return COPY[lang](total, list, extra)
}
