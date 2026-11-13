import { getLang, type Lang } from '../../lib/i18n'

const TEXT: Partial<Record<Exclude<Lang, 'zh' | 'en'>, Record<string, string>>> = {
  'zh-TW': {
    'Match-3': '三消', 'Three in a row wins': '三個相同即可消除', 'Score': '分數', 'Best': '最高', 'Male': '男角', 'Female': '女角', 'Mixed': '混合', 'New game': '新局', 'How to play': '玩法說明', 'Reshuffled': '已重新洗牌', 'No moves — reshuffled': '無可走步，已重新洗牌', 'Tap two adjacent tiles to swap': '點選兩個相鄰圖塊交換', 'Swap back': '交換無效，已還原', 'Combo': '連鎖',
  },
  ja: {
    'Match-3': 'マッチ3', 'Three in a row wins': '3つ揃えると消去', 'Score': 'スコア', 'Best': 'ベスト', 'Male': '男性', 'Female': '女性', 'Mixed': '混合', 'New game': '新しいゲーム', 'How to play': '遊び方', 'Reshuffled': '再シャッフルしました', 'No moves — reshuffled': '手がなく再シャッフルしました', 'Tap two adjacent tiles to swap': '隣り合うタイルをタップして交換', 'Swap back': '無効な交換のため戻しました', 'Combo': 'コンボ',
  },
  fr: {
    'Match-3': 'Match-3', 'Three in a row wins': 'Trois identiques disparaissent', 'Score': 'Score', 'Best': 'Record', 'Male': 'Hommes', 'Female': 'Femmes', 'Mixed': 'Mixte', 'New game': 'Nouvelle partie', 'How to play': 'Règles', 'Reshuffled': 'Mélangé', 'No moves — reshuffled': 'Aucun coup — mélangé', 'Tap two adjacent tiles to swap': 'Touchez deux tuiles adjacentes pour les échanger', 'Swap back': 'Échange annulé', 'Combo': 'Combo',
  },
  es: {
    'Match-3': 'Match-3', 'Three in a row wins': 'Tres iguales desaparecen', 'Score': 'Puntos', 'Best': 'Mejor', 'Male': 'Hombres', 'Female': 'Mujeres', 'Mixed': 'Mixto', 'New game': 'Nueva partida', 'How to play': 'Cómo jugar', 'Reshuffled': 'Barajado', 'No moves — reshuffled': 'Sin movimientos — barajado', 'Tap two adjacent tiles to swap': 'Toca dos fichas adyacentes para intercambiarlas', 'Swap back': 'Intercambio revertido', 'Combo': 'Combo',
  },
  de: {
    'Match-3': 'Match-3', 'Three in a row wins': 'Drei Gleiche verschwinden', 'Score': 'Punkte', 'Best': 'Rekord', 'Male': 'Männer', 'Female': 'Frauen', 'Mixed': 'Gemischt', 'New game': 'Neues Spiel', 'How to play': 'Spielregeln', 'Reshuffled': 'Neu gemischt', 'No moves — reshuffled': 'Keine Züge — neu gemischt', 'Tap two adjacent tiles to swap': 'Zwei benachbarte Steine tippen zum Tauschen', 'Swap back': 'Tausch rückgängig', 'Combo': 'Kombo',
  },
  ko: {
    'Match-3': '매치-3', 'Three in a row wins': '세 개가 맞으면 사라짐', 'Score': '점수', 'Best': '최고', 'Male': '남성', 'Female': '여성', 'Mixed': '혼합', 'New game': '새 게임', 'How to play': '게임 방법', 'Reshuffled': '섞임', 'No moves — reshuffled': '수 없음 — 섞임', 'Tap two adjacent tiles to swap': '인접한 타일 두 개를 탭해 교환', 'Swap back': '교환 취소', 'Combo': '콤보',
  },
  it: {
    'Match-3': 'Match-3', 'Three in a row wins': 'Tre uguali spariscono', 'Score': 'Punti', 'Best': 'Record', 'Male': 'Uomini', 'Female': 'Donne', 'Mixed': 'Misto', 'New game': 'Nuova partita', 'How to play': 'Come si gioca', 'Reshuffled': 'Rimescolato', 'No moves — reshuffled': 'Nessuna mossa — rimescolato', 'Tap two adjacent tiles to swap': 'Tocca due tessere adiacenti per scambiarle', 'Swap back': 'Scambio annullato', 'Combo': 'Combo',
  },
  ar: {
    'Match-3': 'مطابقة-3', 'Three in a row wins': 'ثلاثة متطابقة تختفي', 'Score': 'النقاط', 'Best': 'الأفضل', 'Male': 'ذكور', 'Female': 'إناث', 'Mixed': 'مختلط', 'New game': 'لعبة جديدة', 'How to play': 'طريقة اللعب', 'Reshuffled': 'أُعيد خلطه', 'No moves — reshuffled': 'لا حركات — أُعيد خلطه', 'Tap two adjacent tiles to swap': 'انقر على قطعتين متجاورتين لتبديلها', 'Swap back': 'تم التراجع عن التبديل', 'Combo': 'كومبو',
  },
}

export function matchText(zh: string, en: string): string {
  const lang = getLang()
  if (lang === 'zh') return zh
  if (lang === 'en') return en
  return TEXT[lang]?.[en] ?? en
}
