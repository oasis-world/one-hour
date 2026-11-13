import { getLang, type Lang } from '../../lib/i18n'

const TEXT: Partial<Record<Exclude<Lang, 'zh' | 'en'>, Record<string, string>>> = {
  'zh-TW': {
    'Slot Machine': '老虎機', 'A little luck, a classic spin': '經典水果機，來試試手氣', 'CLASSIC FRUIT · 5 REELS': '經典水果 · 五軸', BALANCE: '餘額', 'LAST WIN': '上次贏得', Bet: '押注', SPIN: '旋轉', SPINNING: '旋轉中', '5 fixed paylines': '5 條固定賠付線', Reel: '轉軸', 'Five reels, three rows of symbols': '五個轉軸，三列符號', 'Payout per line = bet × multiplier': '每條線獎金 = 單線押注 × 倍數', 'Congratulations!': '恭喜中獎！',
    'How to play': '遊戲說明', '5 fixed paylines · 3+ matching symbols in a row win anywhere': '5 條固定賠付線 · 任意位置連續 3 個以上相同符號即可獲勝', 'Bet applies to each of the 5 lines': '押注金額套用於每一條賠付線', 'Wild substitutes for any symbol': '百搭可代替任何符號', 'Uses your star points · no real money': '消耗星星積分 · 不涉及真錢',
    'Pay table': '賠付表', '3 in a row': '連續 3 個', '4 in a row': '連續 4 個', '5 in a row': '連續 5 個', WILD: '百搭', 'Nice hit!': '漂亮！', 'No line hit — try again': '沒有連線，再試一次',
    'Refill 500 credits': '補充 500 點', SOUND: '音效', 'Sound on': '開啟音效', 'Sound off': '關閉音效', 'Best win': '最高獎金', Spins: '旋轉次數', Cherry: '櫻桃', Lemon: '檸檬', Orange: '橘子', Grapes: '葡萄', Bell: '鈴鐺', Star: '星星', Diamond: '鑽石',
    'Total bet': '總押注', Net: '淨額', Payout: '派彩', 'No win this spin': '本次未中獎', 'Send messages, photos, or play other games to earn points': '請傳送訊息、照片或玩其他遊戲來賺取積分',
  },
  ja: {
    'Slot Machine': 'スロットマシン', 'A little luck, a classic spin': 'クラシックな運試しスピン', 'CLASSIC FRUIT · 5 REELS': 'クラシックフルーツ · 5リール', BALANCE: '残高', 'LAST WIN': '前回の勝ち', Bet: 'ベット', SPIN: 'スピン', SPINNING: '回転中', '5 fixed paylines': '固定5ライン', Reel: 'リール', 'Five reels, three rows of symbols': '5リール、3段のシンボル', 'Payout per line = bet × multiplier': 'ライン配当 = ラインベット × 倍率', 'Congratulations!': 'おめでとうございます！',
    'How to play': '遊び方', '5 fixed paylines · 3+ matching symbols in a row win anywhere': '固定5ライン · 場所を問わず同じシンボルが3つ以上連続すると当たり', 'Bet applies to each of the 5 lines': 'ベットは5つのラインそれぞれに適用されます', 'Wild substitutes for any symbol': 'ワイルドはどのシンボルの代わりにもなります', 'Uses your star points · no real money': '星ポイントを使用 · 実際のお金は使いません',
    'Pay table': '配当表', '3 in a row': '3個一致', '4 in a row': '4個一致', '5 in a row': '5個一致', WILD: 'ワイルド', 'Nice hit!': 'お見事！', 'No line hit — try again': '今回はハズレ · もう一度',
    'Refill 500 credits': '500クレジット補充', SOUND: 'サウンド', 'Sound on': 'サウンドオン', 'Sound off': 'サウンドオフ', 'Best win': '最高配当', Spins: 'スピン回数', Cherry: 'チェリー', Lemon: 'レモン', Orange: 'オレンジ', Grapes: 'ぶどう', Bell: 'ベル', Star: 'スター', Diamond: 'ダイヤ',
    'Total bet': '合計ベット', Net: '差引', Payout: '払戻', 'No win this spin': '今回は当たりなし', 'Send messages, photos, or play other games to earn points': 'メッセージや写真を送信するか、ほかのゲームをプレイしてポイントを獲得しましょう',
  },
  fr: {
    'Slot Machine': 'Machine à sous', 'A little luck, a classic spin': 'Un tour classique, un brin de chance', 'CLASSIC FRUIT · 5 REELS': 'FRUITS CLASSIQUES · 5 ROULEAUX', BALANCE: 'CRÉDITS', 'LAST WIN': 'DERNIER GAIN', Bet: 'Mise', SPIN: 'JOUER', SPINNING: 'EN COURS', '5 fixed paylines': '5 lignes fixes', Reel: 'Rouleau', 'Five reels, three rows of symbols': 'Cinq rouleaux, trois rangées de symboles', 'Payout per line = bet × multiplier': 'Gain par ligne = mise × multiplicateur', 'Congratulations!': 'Félicitations !',
    'How to play': 'Règles du jeu', '5 fixed paylines · 3+ matching symbols in a row win anywhere': '5 lignes fixes · 3 symboles identiques ou plus à la suite gagnent partout sur la ligne', 'Bet applies to each of the 5 lines': 'La mise s’applique à chacune des cinq lignes', 'Wild substitutes for any symbol': 'Le joker remplace n’importe quel symbole', 'Uses your star points · no real money': 'Utilise vos points étoile · aucun argent réel',
    'Pay table': 'Table des gains', '3 in a row': '3 à la suite', '4 in a row': '4 à la suite', '5 in a row': '5 à la suite', WILD: 'JOKER', 'Nice hit!': 'Bien joué !', 'No line hit — try again': 'Pas de ligne gagnante · réessayez',
    'Refill 500 credits': 'Ajouter 500 crédits', SOUND: 'SON', 'Sound on': 'Son activé', 'Sound off': 'Son coupé', 'Best win': 'Meilleur gain', Spins: 'Tours', Cherry: 'Cerise', Lemon: 'Citron', Orange: 'Orange', Grapes: 'Raisin', Bell: 'Cloche', Star: 'Étoile', Diamond: 'Diamant',
    'Total bet': 'Mise totale', Net: 'Net', Payout: 'Gain', 'No win this spin': 'Pas de gain cette fois', 'Send messages, photos, or play other games to earn points': 'Envoyez des messages ou des photos, ou jouez à d’autres jeux pour gagner des points',
  },
  es: {
    'Slot Machine': 'Tragaperras', 'A little luck, a classic spin': 'Un giro clásico con un poco de suerte', 'CLASSIC FRUIT · 5 REELS': 'FRUTAS CLÁSICAS · 5 RODILLOS', BALANCE: 'CRÉDITOS', 'LAST WIN': 'ÚLTIMO PREMIO', Bet: 'Apuesta', SPIN: 'GIRAR', SPINNING: 'GIRANDO', '5 fixed paylines': '5 líneas fijas', Reel: 'Rodillo', 'Five reels, three rows of symbols': 'Cinco rodillos, tres filas de símbolos', 'Payout per line = bet × multiplier': 'Premio por línea = apuesta × multiplicador', 'Congratulations!': '¡Felicidades!',
    'How to play': 'Cómo jugar', '5 fixed paylines · 3+ matching symbols in a row win anywhere': '5 líneas fijas · ganan 3 o más símbolos iguales seguidos en cualquier posición', 'Bet applies to each of the 5 lines': 'La apuesta se aplica a cada una de las cinco líneas', 'Wild substitutes for any symbol': 'El comodín sustituye cualquier símbolo', 'Uses your star points · no real money': 'Usa tus puntos estrella · sin dinero real',
    'Pay table': 'Tabla de premios', '3 in a row': '3 seguidos', '4 in a row': '4 seguidos', '5 in a row': '5 seguidos', WILD: 'COMODÍN', 'Nice hit!': '¡Buena jugada!', 'No line hit — try again': 'Sin línea ganadora · inténtalo otra vez',
    'Refill 500 credits': 'Añadir 500 créditos', SOUND: 'SONIDO', 'Sound on': 'Sonido activado', 'Sound off': 'Sonido desactivado', 'Best win': 'Mejor premio', Spins: 'Giros', Cherry: 'Cereza', Lemon: 'Limón', Orange: 'Naranja', Grapes: 'Uvas', Bell: 'Campana', Star: 'Estrella', Diamond: 'Diamante',
    'Total bet': 'Apuesta total', Net: 'Neto', Payout: 'Premio', 'No win this spin': 'Sin premio esta vez', 'Send messages, photos, or play other games to earn points': 'Envía mensajes o fotos, o juega a otros juegos para ganar puntos',
  },
  de: {
    'Slot Machine': 'Spielautomat', 'A little luck, a classic spin': 'Klassischer Dreh mit etwas Glück', 'CLASSIC FRUIT · 5 REELS': 'KLASSISCHE FRÜCHTE · 5 WALZEN', BALANCE: 'GUTHABEN', 'LAST WIN': 'LETZTER GEWINN', Bet: 'Einsatz', SPIN: 'DREHEN', SPINNING: 'DREHT', '5 fixed paylines': '5 feste Gewinnlinien', Reel: 'Walze', 'Five reels, three rows of symbols': 'Fünf Walzen, drei Symbolreihen', 'Payout per line = bet × multiplier': 'Gewinn pro Linie = Einsatz × Multiplikator', 'Congratulations!': 'Glückwunsch!',
    'How to play': 'Spielregeln', '5 fixed paylines · 3+ matching symbols in a row win anywhere': '5 feste Gewinnlinien · 3 oder mehr gleiche Symbole in Folge gewinnen überall auf der Linie', 'Bet applies to each of the 5 lines': 'Der Einsatz gilt für jede der fünf Gewinnlinien', 'Wild substitutes for any symbol': 'Wild ersetzt jedes Symbol', 'Uses your star points · no real money': 'Verwendet deine Sternpunkte · kein echtes Geld',
    'Pay table': 'Gewinntabelle', '3 in a row': '3 in Folge', '4 in a row': '4 in Folge', '5 in a row': '5 in Folge', WILD: 'WILD', 'Nice hit!': 'Volltreffer!', 'No line hit — try again': 'Keine Gewinnlinie · versuch es noch mal',
    'Refill 500 credits': '500 Punkte auffüllen', SOUND: 'TON', 'Sound on': 'Ton an', 'Sound off': 'Ton aus', 'Best win': 'Höchstgewinn', Spins: 'Drehungen', Cherry: 'Kirsche', Lemon: 'Zitrone', Orange: 'Orange', Grapes: 'Trauben', Bell: 'Glocke', Star: 'Stern', Diamond: 'Diamant',
    'Total bet': 'Gesamteinsatz', Net: 'Netto', Payout: 'Auszahlung', 'No win this spin': 'Diesmal kein Gewinn', 'Send messages, photos, or play other games to earn points': 'Sende Nachrichten oder Fotos oder spiele andere Spiele, um Punkte zu verdienen',
  },
  ko: {
    'Slot Machine': '슬롯머신', 'A little luck, a classic spin': '행운을 시험하는 클래식 슬롯', 'CLASSIC FRUIT · 5 REELS': '클래식 과일 · 5릴', BALANCE: '잔액', 'LAST WIN': '최근 당첨', Bet: '베팅', SPIN: '돌리기', SPINNING: '회전 중', '5 fixed paylines': '고정 페이라인 5개', Reel: '릴', 'Five reels, three rows of symbols': '5개 릴, 3줄 심볼', 'Payout per line = bet × multiplier': '라인별 당첨 = 베팅액 × 배수', 'Congratulations!': '축하합니다!',
    'How to play': '게임 방법', '5 fixed paylines · 3+ matching symbols in a row win anywhere': '고정 페이라인 5개 · 위치와 관계없이 같은 심볼 3개 이상 연속이면 당첨', 'Bet applies to each of the 5 lines': '베팅액은 5개 라인 각각에 적용됩니다', 'Wild substitutes for any symbol': '와일드는 모든 심볼을 대신합니다', 'Uses your star points · no real money': '별 포인트 사용 · 실제 돈 없음',
    'Pay table': '당첨표', '3 in a row': '3개 일치', '4 in a row': '4개 일치', '5 in a row': '5개 일치', WILD: '와일드', 'Nice hit!': '멋진 당첨!', 'No line hit — try again': '당첨 라인이 없어요 · 다시 해보세요',
    'Refill 500 credits': '크레딧 500 충전', SOUND: '사운드', 'Sound on': '사운드 켜기', 'Sound off': '사운드 끄기', 'Best win': '최고 당첨', Spins: '회전 횟수', Cherry: '체리', Lemon: '레몬', Orange: '오렌지', Grapes: '포도', Bell: '종', Star: '별', Diamond: '다이아몬드',
    'Total bet': '총 베팅', Net: '순액', Payout: '당첨금', 'No win this spin': '이번 회차는 미당첨', 'Send messages, photos, or play other games to earn points': '메시지나 사진을 보내거나 다른 게임을 플레이해 포인트를 획득하세요',
  },
  it: {
    'Slot Machine': 'Slot Machine', 'A little luck, a classic spin': 'Un classico giro fortunato', 'CLASSIC FRUIT · 5 REELS': 'FRUTTA CLASSICA · 5 RULLI', BALANCE: 'CREDITI', 'LAST WIN': 'ULTIMA VINCITA', Bet: 'Puntata', SPIN: 'GIRA', SPINNING: 'IN CORSO', '5 fixed paylines': '5 linee fisse', Reel: 'Rullo', 'Five reels, three rows of symbols': 'Cinque rulli, tre file di simboli', 'Payout per line = bet × multiplier': 'Vincita per linea = puntata × moltiplicatore', 'Congratulations!': 'Congratulazioni!',
    'How to play': 'Come si gioca', '5 fixed paylines · 3+ matching symbols in a row win anywhere': '5 linee fisse · vincono 3 o più simboli uguali consecutivi in qualsiasi posizione', 'Bet applies to each of the 5 lines': 'La puntata si applica a ciascuna delle cinque linee', 'Wild substitutes for any symbol': 'Il jolly sostituisce qualsiasi simbolo', 'Uses your star points · no real money': 'Usa i tuoi punti stella · nessun denaro reale',
    'Pay table': 'Tabella vincite', '3 in a row': '3 di fila', '4 in a row': '4 di fila', '5 in a row': '5 di fila', WILD: 'JOLLY', 'Nice hit!': 'Bel colpo!', 'No line hit — try again': 'Nessuna linea vincente · riprova',
    'Refill 500 credits': 'Aggiungi 500 crediti', SOUND: 'AUDIO', 'Sound on': 'Audio attivo', 'Sound off': 'Audio disattivato', 'Best win': 'Vincita record', Spins: 'Giri', Cherry: 'Ciliegia', Lemon: 'Limone', Orange: 'Arancia', Grapes: 'Uva', Bell: 'Campana', Star: 'Stella', Diamond: 'Diamante',
    'Total bet': 'Puntata totale', Net: 'Netto', Payout: 'Vincita', 'No win this spin': 'Nessuna vincita questa volta', 'Send messages, photos, or play other games to earn points': 'Invia messaggi o foto, oppure gioca ad altri giochi per guadagnare punti',
  },
  ar: {
    'Slot Machine': 'ماكينة الحظ', 'A little luck, a classic spin': 'دورة كلاسيكية مع قليل من الحظ', 'CLASSIC FRUIT · 5 REELS': 'فواكه كلاسيكية · 5 بكرات', BALANCE: 'الرصيد', 'LAST WIN': 'آخر ربح', Bet: 'الرهان', SPIN: 'دوّر', SPINNING: 'يدور', '5 fixed paylines': '5 خطوط ثابتة', Reel: 'بكرة', 'Five reels, three rows of symbols': 'خمس بكرات وثلاثة صفوف من الرموز', 'Payout per line = bet × multiplier': 'الجائزة لكل خط = الرهان × المضاعف', 'Congratulations!': 'تهانينا!',
    'How to play': 'طريقة اللعب', '5 fixed paylines · 3+ matching symbols in a row win anywhere': '5 خطوط ثابتة · الفوز عند ظهور 3 رموز متطابقة متتالية أو أكثر في أي موضع', 'Bet applies to each of the 5 lines': 'يُطبّق الرهان على كل خط من الخطوط الخمسة', 'Wild substitutes for any symbol': 'الرمز الجامح يحل محل أي رمز', 'Uses your star points · no real money': 'يستخدم نقاط النجوم الخاصة بك · بلا أموال حقيقية',
    'Pay table': 'جدول الجوائز', '3 in a row': '3 متتالية', '4 in a row': '4 متتالية', '5 in a row': '5 متتالية', WILD: 'جامح', 'Nice hit!': 'إصابة رائعة!', 'No line hit — try again': 'لا يوجد خط فائز · حاول مجددًا',
    'Refill 500 credits': 'أضف 500 رصيد', SOUND: 'الصوت', 'Sound on': 'تشغيل الصوت', 'Sound off': 'كتم الصوت', 'Best win': 'أفضل ربح', Spins: 'عدد اللفات', Cherry: 'كرز', Lemon: 'ليمون', Orange: 'برتقال', Grapes: 'عنب', Bell: 'جرس', Star: 'نجمة', Diamond: 'ألماس',
    'Total bet': 'إجمالي الرهان', Net: 'الصافي', Payout: 'العائد', 'No win this spin': 'لا فوز في هذه الجولة', 'Send messages, photos, or play other games to earn points': 'أرسل رسائل أو صورًا، أو العب ألعابًا أخرى لكسب النقاط',
  },
}

export function slotText(zh: string, en: string): string {
  const lang = getLang()
  return lang === 'zh' ? zh : lang === 'en' ? en : TEXT[lang]?.[en] ?? en
}
