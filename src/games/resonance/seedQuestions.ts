import { L } from './localized'
import type { ResonanceQuestion } from './types'

/**
 * Fully-localized fallback bank (all 10 languages). Used when the AI Edge
 * Function is unavailable or returns nothing usable, so a card is never empty.
 */
export function localSeed(): ResonanceQuestion[] {
  return [
    q(
      'q-teleport',
      L('如果现在能瞬移到任何地方，你会去？', '如果現在能瞬移到任何地方，你會去？',
        'If you could teleport anywhere right now, where would you go?',
        '今すぐどこへでもテレポートできるなら、どこに行く？',
        'Si vous pouviez vous téléporter n’importe où maintenant, où iriez-vous ?',
        'Si pudieras teletransportarte ahora mismo, ¿adónde irías?',
        'Wenn du dich gerade überallhin teleportieren könntest, wohin würdest du gehen?',
        '지금 어디든 순간이동할 수 있다면 어디로 갈래요?',
        'Se potessi teletrasportarti ora da qualsiasi parte, dove andresti?',
        'لو استطعت الانتقال الفوري إلى أي مكان الآن، أين ستذهب؟'),
      [
        o('a', '🌊', '海边发呆', '海邊發呆', 'A quiet beach', '静かな海でぼーっと', 'Une plage tranquille', 'Una playa tranquila', 'Ein ruhiger Strand', '조용한 해변에서 멍때리기', 'Una spiaggia tranquilla', 'شاطئ هادئ'),
        o('b', '🏔️', '山顶看日出', '山頂看日出', 'A mountain sunrise', '山頂で日の出', 'Un lever de soleil à la montagne', 'Un amanecer en la montaña', 'Ein Sonnenaufgang am Berg', '산 정상에서 일출', 'Un’alba in montagna', 'شروق الشمس من فوق الجبل'),
        o('c', '🏮', '热闹的夜市', '熱鬧的夜市', 'A lively night market', '活気ある夜市', 'Un marché nocturne animé', 'Un mercado nocturno animado', 'Ein lebhafter Nachtmarkt', '활기찬 야시장', 'Un mercato notturno vivace', 'سوق ليلي نابض بالحياة'),
        o('d', '🛌', '温暖的被窝', '溫暖的被窩', 'A cozy warm bed', '暖かい布団', 'Un lit douillet', 'Una cama acogedora', 'Ein gemütliches Bett', '포근한 이불 속', 'Un letto accogliente', 'سرير دافئ مريح'),
      ],
    ),
    q(
      'q-weekend',
      L('周末的理想计划是？', '週末的理想計畫是？', 'Your ideal weekend plan?',
        '理想の週末の過ごし方は？', 'Votre plan idéal pour le week-end ?', '¿Tu plan ideal de fin de semana?',
        'Wie sieht dein ideales Wochenende aus?', '이상적인 주말 계획은?', 'Il tuo piano ideale per il weekend?',
        'ما خطتك المثالية لعطلة نهاية الأسبوع؟'),
      [
        o('a', '😴', '睡到自然醒', '睡到自然醒', 'Sleep in with no alarm', '目覚ましなしで寝坊', 'Dormir sans réveil', 'Dormir sin alarma', 'Ausschlafen ohne Wecker', '알람 없이 푹 자기', 'Dormire senza sveglia', 'النوم حتى الاستيقاظ طبيعياً'),
        o('b', '🎉', '约朋友出门', '約朋友出門', 'Go out with friends', '友人と出かける', 'Sortir avec des amis', 'Salir con amigos', 'Mit Freunden ausgehen', '친구들과 외출하기', 'Uscire con gli amici', 'الخروج مع الأصدقاء'),
        o('c', '📖', '一个人安静待着', '一個人安靜待著', 'Quiet time alone', '一人で静かに過ごす', 'Un moment de calme seul', 'Un rato tranquilo a solas', 'Zeit allein in Ruhe', '혼자 조용히 지내기', 'Un momento di quiete da solo', 'وقت هادئ بمفردك'),
        o('d', '🧳', '来一场说走就走的旅行', '來一場說走就走的旅行', 'A spontaneous trip', '思い立ったが吉日で旅行', 'Un voyage spontané', 'Un viaje espontáneo', 'Eine spontane Reise', '즉흥 여행 떠나기', 'Un viaggio spontaneo', 'رحلة عفوية'),
      ],
    ),
    q(
      'q-island',
      L('如果只能带一样东西去荒岛，你选？', '如果只能帶一樣東西去荒島，你選？',
        'Only one item to a desert island — which?', '無人島に一つだけ持っていくなら？',
        'Un seul objet sur une île déserte — lequel ?', '¿Solo un objeto a una isla desierta, cuál?',
        'Nur ein Gegenstand auf eine einsame Insel — welcher?', '무인도에 딱 하나만 가져간다면?',
        'Un solo oggetto su un’isola deserta — quale?', 'شيء واحد فقط إلى جزيرة مهجورة — أيّ شيء؟'),
      [
        o('a', '📚', '一本书', '一本書', 'A good book', '良い本', 'Un bon livre', 'Un buen libro', 'Ein gutes Buch', '좋은 책 한 권', 'Un buon libro', 'كتاب جيد'),
        o('b', '🎵', '一首歌循环播放', '一首歌循環播放', 'One song on repeat', '同じ曲をリピート', 'Une chanson en boucle', 'Una canción en bucle', 'Ein Lied in Dauerschleife', '한 곡 무한 반복', 'Una canzone in loop', 'أغنية واحدة تتكرر'),
        o('c', '🔪', '一把瑞士军刀', '一把瑞士軍刀', 'A Swiss army knife', 'スイスアーミーナイフ', 'Un couteau suisse', 'Una navaja suiza', 'Ein Schweizer Taschenmesser', '스위스 아미 나이프', 'Un coltellino svizzero', 'سكين سويسري'),
        o('d', '🍦', '一桶冰淇淋', '一桶冰淇淋', 'A bucket of ice cream', 'バケツのアイスクリーム', 'Un seau de glace', 'Un cubo de helado', 'Ein Eimer Eiscreme', '아이스크림 한 통', 'Un secchiello di gelato', 'دلو من الآيس كريم'),
      ],
    ),
    q(
      'q-saying',
      L('你更认同哪句话？', '你更認同哪句話？', 'Which saying do you agree with most?',
        'どの言葉に一番共感しますか？', 'Quelle maxime partagez-vous le plus ?', '¿Con qué dicho te identificas más?',
        'Welchem Sprichwort stimmst du am meisten zu?', '어떤 말에 가장 공감하나요?', 'Con quale detto ti trovi più d’accordo?',
        'بأي مقولة تؤمن أكثر؟'),
      [
        o('a', '🌬️', '计划赶不上变化', '計畫趕不上變化', 'Plans never survive change', '計画は変化に勝てない', 'Les plans ne résistent pas au changement', 'Los planes no sobreviven al cambio', 'Pläne überleben den Wandel nicht', '계획은 변화를 이기지 못한다', 'I piani non sopravvivono al cambiamento', 'الخطط لا تصمد أمام التغيير'),
        o('b', '🎯', '机会留给有准备的人', '機會留給有準備的人', 'Luck favors the prepared', '幸運は準備した者に', 'La chance sourit aux préparés', 'La suerte favorece al preparado', 'Das Glück begünstigt den Vorbereiteten', '행운은 준비된 자에게', 'La fortuna premia chi è preparato', 'الحظ يصاحب المُستعدّ'),
        o('c', '🍵', '简单就是幸福', '簡單就是幸福', 'Simple is happy', 'シンプルが幸せ', 'La simplicité est le bonheur', 'Lo simple es la felicidad', 'Einfach sein ist glücklich', '단순함이 곧 행복', 'La semplicità è felicità', 'البساطة هي السعادة'),
        o('d', '🎈', '及时行乐', '及時行樂', 'Carpe diem', '今を楽しむ', 'Profite de l’instant', 'Vive el momento', 'Carpe diem', '지금을 즐겨라', 'Carpe diem', 'اغتنم الفرصة الآن'),
      ],
    ),
    q(
      'q-latenight',
      L('深夜饿了，你最想吃？', '深夜餓了，你最想吃？', 'It’s late and you’re hungry — what do you crave?',
        '夜遅くにお腹が空いたら、何が食べたい？', 'Il est tard et vous avez faim — que désirez-vous ?',
        'Es tarde y tienes hambre — ¿qué se te antoja?', 'Es ist spät und du hast Hunger — worauf hast du Lust?',
        '늦은 밤 출출할 때 뭐가 땡기나요?', 'È tardi e hai fame — cosa desideri?',
        'الوقت متأخر وأنت جائع — ما الذي تشتهيه؟'),
      [
        o('a', '🍜', '热腾腾的泡面', '熱騰騰的泡麵', 'Steaming hot noodles', '熱々のラーメン', 'Des nouilles brûlantes', 'Fideos calientes al vapor', 'Dampfende Nudeln', '뜨끈한 라면', 'Noodle fumanti', 'نودلز ساخنة'),
        o('b', '🍓', '甜甜的水果', '甜甜的水果', 'Sweet fresh fruit', '甘い果物', 'Des fruits sucrés', 'Fruta dulce', 'Süßes Obst', '달콤한 과일', 'Frutta dolce', 'فاكهة حلوة'),
        o('c', '🍗', '炸鸡和啤酒', '炸雞和啤酒', 'Fried chicken and beer', '唐揚げとビール', 'Poulet frit et bière', 'Pollo frito y cerveza', 'Fried Chicken und Bier', '치킨과 맥주', 'Pollo frito e birra', 'دجاج مقلي وبيرة'),
        o('d', '😑', '什么都不吃直接睡', '什麼都不吃直接睡', 'Nothing, straight to bed', '何も食べずに寝る', 'Rien, direct au lit', 'Nada, directo a la cama', 'Nichts, direkt ins Bett', '아무것도 안 먹고 바로 자기', 'Niente, dritto a letto', 'لا شيء، مباشرة إلى السرير'),
      ],
    ),
  ]
}

function q(id: string, prompt: ReturnType<typeof L>, options: ResonanceQuestion['options']): ResonanceQuestion {
  return { id, prompt, options }
}
function o(id: string, emoji: string, zh: string, zhTW: string, en: string, ja: string, fr: string, es: string, de: string, ko: string, it: string, ar: string) {
  return { id, emoji, label: L(zh, zhTW, en, ja, fr, es, de, ko, it, ar) }
}
