import type { Lang } from '../lib/i18n'

export const SUMMARY_COPY: Record<Lang, {
  headline: string
  farewell: string
  messages: string
  gomoku: string
  xiangqi: string
  wins: string
  losses: string
  interactions: string
  noInteractions: string
  sayGoodbye: string
  nextJourney: string
  close: string
}> = {
  zh: {
    headline: '一个小时虽然短暂，过程却很丰富。', farewell: '说再见，继续旅程！',
    messages: '本小时内发送消息', gomoku: '五子棋对局', xiangqi: '中国象棋对局',
    wins: '胜', losses: '负', interactions: '互动过的用户', sayGoodbye: '说再见',
    noInteractions: '目前没有仍在房间里的互动用户。', nextJourney: '下一段旅程',
    close: '关闭',
  },
  'zh-TW': {
    headline: '一個小時雖然短暫，過程卻很豐富。', farewell: '說再見，繼續旅程！',
    messages: '本小時內發送訊息', gomoku: '五子棋對局', xiangqi: '中國象棋對局',
    wins: '勝', losses: '負', interactions: '互動過的使用者', sayGoodbye: '說再見',
    noInteractions: '目前沒有仍在聊天室裡的互動使用者。', nextJourney: '下一段旅程',
    close: '關閉',
  },
  en: {
    headline: 'An hour is brief, yet the journey was rich.', farewell: 'Say goodbye and continue onward!',
    messages: 'Messages sent this hour', gomoku: 'Gomoku games', xiangqi: 'Chinese chess games',
    wins: 'W', losses: 'L', interactions: 'People you interacted with', sayGoodbye: 'Say goodbye',
    noInteractions: 'No interacted users are still in the room.', nextJourney: 'Next journey',
    close: 'Close',
  },
  ja: {
    headline: '一時間は短くても、豊かな時間でした。', farewell: 'さようならを伝えて、次の旅へ！',
    messages: 'この1時間に送ったメッセージ', gomoku: '五目並べの対局', xiangqi: '中国象棋の対局',
    wins: '勝', losses: '敗', interactions: '交流したユーザー', sayGoodbye: 'さようならを伝える',
    noInteractions: '現在ルームにいる交流相手はいません。', nextJourney: '次の旅へ',
    close: '閉じる',
  },
  fr: {
    headline: 'Une heure est brève, mais riche en moments.', farewell: 'Dites au revoir et poursuivez votre voyage !',
    messages: 'Messages envoyés cette heure', gomoku: 'Parties de Gomoku', xiangqi: 'Parties de Xiangqi',
    wins: 'V', losses: 'D', interactions: 'Personnes avec qui vous avez échangé', sayGoodbye: 'Dire au revoir',
    noInteractions: 'Aucune personne avec qui vous avez échangé n’est encore dans le salon.', nextJourney: 'Prochain voyage',
    close: 'Fermer',
  },
  es: {
    headline: 'Una hora es breve, pero estuvo llena de momentos.', farewell: '¡Despídete y continúa tu viaje!',
    messages: 'Mensajes enviados esta hora', gomoku: 'Partidas de Gomoku', xiangqi: 'Partidas de ajedrez chino',
    wins: 'V', losses: 'D', interactions: 'Personas con las que interactuaste', sayGoodbye: 'Despedirse',
    noInteractions: 'Ninguna persona con la que interactuaste sigue en la sala.', nextJourney: 'Próximo viaje',
    close: 'Cerrar',
  },
  de: {
    headline: 'Eine Stunde ist kurz, aber voller schöner Momente.', farewell: 'Sag auf Wiedersehen und setze deine Reise fort!',
    messages: 'Nachrichten in dieser Stunde', gomoku: 'Gomoku-Partien', xiangqi: 'Chinesische Schachpartien',
    wins: 'S', losses: 'N', interactions: 'Personen, mit denen du interagiert hast', sayGoodbye: 'Verabschieden',
    noInteractions: 'Niemand, mit dem du interagiert hast, ist noch im Raum.', nextJourney: 'Nächste Reise',
    close: 'Schließen',
  },
  ko: {
    headline: '한 시간은 짧지만, 참 풍성한 시간이었어요.', farewell: '작별 인사를 하고 다음 여정을 이어가세요!',
    messages: '이번 시간에 보낸 메시지', gomoku: '오목 대국', xiangqi: '중국 장기 대국',
    wins: '승', losses: '패', interactions: '교류한 사용자', sayGoodbye: '작별 인사하기',
    noInteractions: '현재 방에 남아 있는 교류 상대가 없습니다.', nextJourney: '다음 여정',
    close: '닫기',
  },
  it: {
    headline: 'Un’ora è breve, ma ricca di momenti.', farewell: 'Saluta e continua il tuo viaggio!',
    messages: 'Messaggi inviati in quest’ora', gomoku: 'Partite di Gomoku', xiangqi: 'Partite di scacchi cinesi',
    wins: 'V', losses: 'P', interactions: 'Persone con cui hai interagito', sayGoodbye: 'Saluta',
    noInteractions: 'Nessuna persona con cui hai interagito è ancora nella stanza.', nextJourney: 'Prossimo viaggio',
    close: 'Chiudi',
  },
  ar: {
    headline: 'ساعة قصيرة، لكنها كانت رحلة غنية.', farewell: 'ودّع الآخرين وتابع رحلتك!',
    messages: 'الرسائل المرسلة خلال هذه الساعة', gomoku: 'مباريات غوموكو', xiangqi: 'مباريات الشطرنج الصيني',
    wins: 'فوز', losses: 'خسارة', interactions: 'المستخدمون الذين تفاعلت معهم', sayGoodbye: 'ودّع',
    noInteractions: 'لا يوجد في الغرفة الآن مستخدمون تفاعلت معهم.', nextJourney: 'الرحلة التالية',
    close: 'إغلاق',
  },
}
