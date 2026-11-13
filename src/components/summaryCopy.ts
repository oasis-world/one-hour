import type { Lang } from '../lib/i18n'

export const SUMMARY_COPY: Record<Lang, {
  headline: string
  farewell: string
  messages: string
  photos: string
  games: string
  balanceLabel: string
  pointsLabel: string
  messageSummary: string
  photoSummary: string
  gameSummary: string
  balanceSummary: string
  giftsSummary: string
  noGifts: string
  noPoints: string
  gomoku: string
  xiangqi: string
  chess: string
  play: string
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
    messages: '发送的消息', photos: '分享的照片', games: '游玩游戏', balanceLabel: '1 小时结束时的积分', pointsLabel: '积分',
    messageSummary: '你发送了 {count} 条消息，获得 {points} 积分', photoSummary: '你分享了 {count} 张照片，获得 {points} 积分',
    gameSummary: '你玩了：五子棋 {gomoku} 局、中国象棋 {xiangqi} 局、国际象棋 {chess} 局，获得 {points} 积分',
    balanceSummary: '1 小时结束时，你一共有 {points} 积分', giftsSummary: '送给了：', noGifts: '没有在线用户，积分已销毁。', noPoints: '没有剩余积分可以赠送。',
    gomoku: '五子棋对局', xiangqi: '中国象棋对局', chess: '国际象棋对局', play: '玩',
    wins: '胜', losses: '负', interactions: '互动过的用户', sayGoodbye: '说再见',
    noInteractions: '目前没有仍在房间里的互动用户。', nextJourney: '下一段旅程',
    close: '关闭',
  },
  'zh-TW': {
    headline: '一個小時雖然短暫，過程卻很豐富。', farewell: '說再見，繼續旅程！',
    messages: '傳送的訊息', photos: '分享的照片', games: '遊玩的遊戲', balanceLabel: '1 小時結束時的積分', pointsLabel: '積分',
    messageSummary: '你傳送了 {count} 則訊息，獲得 {points} 點積分', photoSummary: '你分享了 {count} 張照片，獲得 {points} 點積分',
    gameSummary: '你玩了：五子棋 {gomoku} 局、中國象棋 {xiangqi} 局、國際象棋 {chess} 局，獲得 {points} 點積分',
    balanceSummary: '1 小時結束時，你一共有 {points} 點積分', giftsSummary: '送給了：', noGifts: '沒有使用者在線，積分已銷毀。', noPoints: '沒有剩餘積分可以贈送。',
    gomoku: '五子棋對局', xiangqi: '中國象棋對局', chess: '國際象棋對局', play: '玩',
    wins: '勝', losses: '負', interactions: '互動過的使用者', sayGoodbye: '說再見',
    noInteractions: '目前沒有仍在聊天室裡的互動使用者。', nextJourney: '下一段旅程',
    close: '關閉',
  },
  en: {
    headline: 'An hour is brief, yet the journey was rich.', farewell: 'Say goodbye and continue onward!',
    messages: 'Messages sent', photos: 'Photos shared', games: 'Games played', balanceLabel: 'Points at the end of the hour', pointsLabel: 'Points',
    messageSummary: 'You sent {count} messages and earned {points} points', photoSummary: 'You shared {count} photos and earned {points} points',
    gameSummary: 'You played {gomoku} Gomoku, {xiangqi} Chinese chess, and {chess} chess games, earning {points} points',
    balanceSummary: 'At the end of the hour, you had {points} points', giftsSummary: 'Given to:', noGifts: 'No one was online, so the points were discarded.', noPoints: 'No points remained to give.',
    gomoku: 'Gomoku games', xiangqi: 'Chinese chess games', chess: 'Chess games', play: 'Play',
    wins: 'W', losses: 'L', interactions: 'People you interacted with', sayGoodbye: 'Say goodbye',
    noInteractions: 'No interacted users are still in the room.', nextJourney: 'Next journey',
    close: 'Close',
  },
  ja: {
    headline: '一時間は短くても、豊かな時間でした。', farewell: 'さようならを伝えて、次の旅へ！',
    messages: '送信メッセージ', photos: '共有した写真', games: 'プレイしたゲーム', balanceLabel: '1時間終了時のポイント', pointsLabel: 'ポイント',
    messageSummary: '{count}件のメッセージを送り、{points}ポイント獲得', photoSummary: '{count}枚の写真を共有し、{points}ポイント獲得',
    gameSummary: '五目並べ{gomoku}回、中国象棋{xiangqi}回、チェス{chess}回をプレイし、{points}ポイント獲得', balanceSummary: '1時間終了時のポイント：{points}', giftsSummary: '贈呈先：', noGifts: 'オンラインのユーザーがいないため、ポイントは破棄されました。', noPoints: '贈呈できるポイントは残っていません。',
    gomoku: '五目並べの対局', xiangqi: '中国象棋の対局', chess: 'チェスの対局', play: 'プレイ',
    wins: '勝', losses: '敗', interactions: '交流したユーザー', sayGoodbye: 'さようならを伝える',
    noInteractions: '現在ルームにいる交流相手はいません。', nextJourney: '次の旅へ',
    close: '閉じる',
  },
  fr: {
    headline: 'Une heure est brève, mais riche en moments.', farewell: 'Dites au revoir et poursuivez votre voyage !',
    messages: 'Messages envoyés', photos: 'Photos partagées', games: 'Parties jouées', balanceLabel: 'Points à la fin de l’heure', pointsLabel: 'Points',
    messageSummary: 'Vous avez envoyé {count} messages et gagné {points} points', photoSummary: 'Vous avez partagé {count} photos et gagné {points} points',
    gameSummary: '{gomoku} parties de Gomoku, {xiangqi} de Xiangqi et {chess} d’échecs jouées · {points} points gagnés', balanceSummary: 'À la fin de l’heure, vous aviez {points} points', giftsSummary: 'Donnés à :', noGifts: 'Personne n’était en ligne : les points ont été supprimés.', noPoints: 'Il ne restait aucun point à offrir.',
    gomoku: 'Parties de Gomoku', xiangqi: 'Parties de Xiangqi', chess: 'Parties d’échecs', play: 'Jouer',
    wins: 'V', losses: 'D', interactions: 'Personnes avec qui vous avez échangé', sayGoodbye: 'Dire au revoir',
    noInteractions: 'Aucune personne avec qui vous avez échangé n’est encore dans le salon.', nextJourney: 'Prochain voyage',
    close: 'Fermer',
  },
  es: {
    headline: 'Una hora es breve, pero estuvo llena de momentos.', farewell: '¡Despídete y continúa tu viaje!',
    messages: 'Mensajes enviados', photos: 'Fotos compartidas', games: 'Partidas jugadas', balanceLabel: 'Puntos al terminar la hora', pointsLabel: 'Puntos',
    messageSummary: 'Enviaste {count} mensajes y ganaste {points} puntos', photoSummary: 'Compartiste {count} fotos y ganaste {points} puntos',
    gameSummary: 'Jugaste {gomoku} partidas de Gomoku, {xiangqi} de ajedrez chino y {chess} de ajedrez · {points} puntos', balanceSummary: 'Al terminar la hora tenías {points} puntos', giftsSummary: 'Entregados a:', noGifts: 'No había nadie en línea; los puntos se descartaron.', noPoints: 'No quedaban puntos para regalar.',
    gomoku: 'Partidas de Gomoku', xiangqi: 'Partidas de ajedrez chino', chess: 'Partidas de ajedrez', play: 'Jugar',
    wins: 'V', losses: 'D', interactions: 'Personas con las que interactuaste', sayGoodbye: 'Despedirse',
    noInteractions: 'Ninguna persona con la que interactuaste sigue en la sala.', nextJourney: 'Próximo viaje',
    close: 'Cerrar',
  },
  de: {
    headline: 'Eine Stunde ist kurz, aber voller schöner Momente.', farewell: 'Sag auf Wiedersehen und setze deine Reise fort!',
    messages: 'Gesendete Nachrichten', photos: 'Geteilte Fotos', games: 'Gespielte Partien', balanceLabel: 'Punkte am Ende der Stunde', pointsLabel: 'Punkte',
    messageSummary: 'Du hast {count} Nachrichten gesendet und {points} Punkte verdient', photoSummary: 'Du hast {count} Fotos geteilt und {points} Punkte verdient',
    gameSummary: '{gomoku} Gomoku-, {xiangqi} Xiangqi- und {chess} Schachpartien gespielt · {points} Punkte', balanceSummary: 'Am Ende der Stunde hattest du {points} Punkte', giftsSummary: 'Verschenkt an:', noGifts: 'Niemand war online – die Punkte wurden verworfen.', noPoints: 'Es waren keine Punkte mehr zum Verschenken übrig.',
    gomoku: 'Gomoku-Partien', xiangqi: 'Chinesische Schachpartien', chess: 'Schachpartien', play: 'Spielen',
    wins: 'S', losses: 'N', interactions: 'Personen, mit denen du interagiert hast', sayGoodbye: 'Verabschieden',
    noInteractions: 'Niemand, mit dem du interagiert hast, ist noch im Raum.', nextJourney: 'Nächste Reise',
    close: 'Schließen',
  },
  ko: {
    headline: '한 시간은 짧지만, 참 풍성한 시간이었어요.', farewell: '작별 인사를 하고 다음 여정을 이어가세요!',
    messages: '보낸 메시지', photos: '공유한 사진', games: '플레이한 게임', balanceLabel: '1시간 종료 시 포인트', pointsLabel: '포인트',
    messageSummary: '메시지 {count}개를 보내 {points}포인트를 얻었어요', photoSummary: '사진 {count}장을 공유해 {points}포인트를 얻었어요',
    gameSummary: '오목 {gomoku}회, 중국 장기 {xiangqi}회, 체스 {chess}회를 플레이해 {points}포인트를 얻었어요', balanceSummary: '1시간 종료 시 보유 포인트: {points}', giftsSummary: '선물한 사용자:', noGifts: '온라인 사용자가 없어 포인트가 소멸되었어요.', noPoints: '선물할 포인트가 남아 있지 않아요.',
    gomoku: '오목 대국', xiangqi: '중국 장기 대국', chess: '체스 대국', play: '플레이',
    wins: '승', losses: '패', interactions: '교류한 사용자', sayGoodbye: '작별 인사하기',
    noInteractions: '현재 방에 남아 있는 교류 상대가 없습니다.', nextJourney: '다음 여정',
    close: '닫기',
  },
  it: {
    headline: 'Un’ora è breve, ma ricca di momenti.', farewell: 'Saluta e continua il tuo viaggio!',
    messages: 'Messaggi inviati', photos: 'Foto condivise', games: 'Partite giocate', balanceLabel: 'Punti alla fine dell’ora', pointsLabel: 'Punti',
    messageSummary: 'Hai inviato {count} messaggi e guadagnato {points} punti', photoSummary: 'Hai condiviso {count} foto e guadagnato {points} punti',
    gameSummary: '{gomoku} partite di Gomoku, {xiangqi} di Xiangqi e {chess} di scacchi · {points} punti guadagnati', balanceSummary: 'Alla fine dell’ora avevi {points} punti', giftsSummary: 'Regalati a:', noGifts: 'Nessuno era online: i punti sono stati eliminati.', noPoints: 'Non erano rimasti punti da regalare.',
    gomoku: 'Partite di Gomoku', xiangqi: 'Partite di scacchi cinesi', chess: 'Partite di scacchi', play: 'Giocare',
    wins: 'V', losses: 'P', interactions: 'Persone con cui hai interagito', sayGoodbye: 'Saluta',
    noInteractions: 'Nessuna persona con cui hai interagito è ancora nella stanza.', nextJourney: 'Prossimo viaggio',
    close: 'Chiudi',
  },
  ar: {
    headline: 'ساعة قصيرة، لكنها كانت رحلة غنية.', farewell: 'ودّع الآخرين وتابع رحلتك!',
    messages: 'الرسائل المرسلة', photos: 'الصور المشتركة', games: 'الألعاب التي لعبتها', balanceLabel: 'النقاط عند نهاية الساعة', pointsLabel: 'نقاط',
    messageSummary: 'أرسلت {count} رسالة وربحت {points} نقطة', photoSummary: 'شاركت {count} صورة وربحت {points} نقطة',
    gameSummary: 'لعبت {gomoku} غوموكو و{xiangqi} شطرنج صيني و{chess} شطرنج وربحت {points} نقطة', balanceSummary: 'رصيدك عند نهاية الساعة: {points} نقطة', giftsSummary: 'أُهديت إلى:', noGifts: 'لم يكن أحد متصلاً، لذا تم إتلاف النقاط.', noPoints: 'لم يتبقَّ أي نقاط لإهدائها.',
    gomoku: 'مباريات غوموكو', xiangqi: 'مباريات الشطرنج الصيني', chess: 'مباريات الشطرنج', play: 'لعب',
    wins: 'فوز', losses: 'خسارة', interactions: 'المستخدمون الذين تفاعلت معهم', sayGoodbye: 'ودّع',
    noInteractions: 'لا يوجد في الغرفة الآن مستخدمون تفاعلت معهم.', nextJourney: 'الرحلة التالية',
    close: 'إغلاق',
  },
}
