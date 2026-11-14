import { getLang, type Lang } from '../../lib/i18n'

const TEXT: Partial<Record<Exclude<Lang, 'zh' | 'en'>, Record<string, string>>> = {
  'zh-TW': {
    'Points earned': '獲得積分', 'Refresh cost': '刷新消耗積分',
    'Match-3': '三消', 'Three in a row wins': '三個相同即可消除', 'Score': '分數', 'Best': '最高', 'Star points': '星星積分', 'Refresh (10 points)': '刷新（消耗 10 積分）', 'Not enough star points; refresh costs 10': '星星積分不足，刷新需要 10 分', 'Refresh used 10 star points': '刷新消耗 10 星星積分', 'Male': '男角', 'Female': '女角', 'Mixed': '混合', 'New game': '新局', 'How to play': '玩法說明', 'Reshuffled': '已重新洗牌', 'No moves — reshuffled': '無可走步，已重新洗牌', 'Tap two adjacent tiles to swap': '點選兩個相鄰圖塊交換', 'Swap back': '交換無效，已還原', 'Combo': '連鎖',
  },
  ja: {
    'Points earned': '獲得ポイント', 'Refresh cost': '更新コスト',
    'Match-3': 'マッチ3', 'Three in a row wins': '3つ揃えると消去', 'Score': 'スコア', 'Best': 'ベスト', 'Star points': 'スター ポイント', 'Refresh (10 points)': '更新（10ポイント）', 'Not enough star points; refresh costs 10': '星ポイントが不足しています。更新には10ポイント必要です', 'Refresh used 10 star points': '更新に星ポイントを10使用しました', 'Male': '男性', 'Female': '女性', 'Mixed': '混合', 'New game': '新しいゲーム', 'How to play': '遊び方', 'Reshuffled': '再シャッフルしました', 'No moves — reshuffled': '手がなく再シャッフルしました', 'Tap two adjacent tiles to swap': '隣り合うタイルをタップして交換', 'Swap back': '無効な交換のため戻しました', 'Combo': 'コンボ',
  },
  fr: {
    'Points earned': 'Points gagnés', 'Refresh cost': 'Coût du rafraîchissement',
    'Match-3': 'Match-3', 'Three in a row wins': 'Trois identiques disparaissent', 'Score': 'Score', 'Best': 'Record', 'Star points': 'Points étoile', 'Not enough star points; refresh costs 10': 'Points étoile insuffisants ; la nouvelle partie coûte 10 points', 'Refresh used 10 star points': '10 points étoile utilisés pour actualiser', 'Male': 'Hommes', 'Female': 'Femmes', 'Mixed': 'Mixte', 'New game': 'Nouvelle partie', 'How to play': 'Règles', 'Reshuffled': 'Mélangé', 'No moves — reshuffled': 'Aucun coup — mélangé', 'Tap two adjacent tiles to swap': 'Touchez deux tuiles adjacentes pour les échanger', 'Swap back': 'Échange annulé', 'Combo': 'Combo',
  },
  es: {
    'Points earned': 'Puntos ganados', 'Refresh cost': 'Coste de actualización',
    'Match-3': 'Match-3', 'Three in a row wins': 'Tres iguales desaparecen', 'Score': 'Puntos', 'Best': 'Mejor', 'Star points': 'Puntos estrella', 'Not enough star points; refresh costs 10': 'No hay suficientes puntos estrella; actualizar cuesta 10', 'Refresh used 10 star points': 'Se usaron 10 puntos estrella para actualizar', 'Male': 'Hombres', 'Female': 'Mujeres', 'Mixed': 'Mixto', 'New game': 'Nueva partida', 'How to play': 'Cómo jugar', 'Reshuffled': 'Barajado', 'No moves — reshuffled': 'Sin movimientos — barajado', 'Tap two adjacent tiles to swap': 'Toca dos fichas adyacentes para intercambiarlas', 'Swap back': 'Intercambio revertido', 'Combo': 'Combo',
  },
  de: {
    'Points earned': 'Punkte erhalten', 'Refresh cost': 'Aktualisierungskosten',
    'Match-3': 'Match-3', 'Three in a row wins': 'Drei Gleiche verschwinden', 'Score': 'Punkte', 'Best': 'Rekord', 'Star points': 'Sternpunkte', 'Not enough star points; refresh costs 10': 'Nicht genug Sternpunkte; Aktualisieren kostet 10', 'Refresh used 10 star points': '10 Sternpunkte zum Aktualisieren verwendet', 'Male': 'Männer', 'Female': 'Frauen', 'Mixed': 'Gemischt', 'New game': 'Neues Spiel', 'How to play': 'Spielregeln', 'Reshuffled': 'Neu gemischt', 'No moves — reshuffled': 'Keine Züge — neu gemischt', 'Tap two adjacent tiles to swap': 'Zwei benachbarte Steine tippen zum Tauschen', 'Swap back': 'Tausch rückgängig', 'Combo': 'Kombo',
  },
  ko: {
    'Points earned': '획득 포인트', 'Refresh cost': '새로고침 비용',
    'Match-3': '매치-3', 'Three in a row wins': '세 개가 맞으면 사라짐', 'Score': '점수', 'Best': '최고', 'Star points': '별 포인트', 'Not enough star points; refresh costs 10': '별 포인트가 부족합니다. 새로고침에 10포인트가 필요합니다', 'Refresh used 10 star points': '별 포인트 10점을 사용해 새로고침했습니다', 'Male': '남성', 'Female': '여성', 'Mixed': '혼합', 'New game': '새 게임', 'How to play': '게임 방법', 'Reshuffled': '섞임', 'No moves — reshuffled': '수 없음 — 섞임', 'Tap two adjacent tiles to swap': '인접한 타일 두 개를 탭해 교환', 'Swap back': '교환 취소', 'Combo': '콤보',
  },
  it: {
    'Points earned': 'Punti guadagnati', 'Refresh cost': 'Costo aggiornamento',
    'Match-3': 'Match-3', 'Three in a row wins': 'Tre uguali spariscono', 'Score': 'Punti', 'Best': 'Record', 'Star points': 'Punti stella', 'Not enough star points; refresh costs 10': 'Punti stella insufficienti; aggiornare costa 10 punti', 'Refresh used 10 star points': 'Usati 10 punti stella per aggiornare', 'Male': 'Uomini', 'Female': 'Donne', 'Mixed': 'Misto', 'New game': 'Nuova partita', 'How to play': 'Come si gioca', 'Reshuffled': 'Rimescolato', 'No moves — reshuffled': 'Nessuna mossa — rimescolato', 'Tap two adjacent tiles to swap': 'Tocca due tessere adiacenti per scambiarle', 'Swap back': 'Scambio annullato', 'Combo': 'Combo',
  },
  ar: {
    'Points earned': 'النقاط المكتسبة', 'Refresh cost': 'تكلفة التحديث',
    'Match-3': 'مطابقة-3', 'Three in a row wins': 'ثلاثة متطابقة تختفي', 'Score': 'النقاط', 'Best': 'الأفضل', 'Star points': 'نقاط النجوم', 'Not enough star points; refresh costs 10': 'نقاط النجوم غير كافية؛ التحديث يكلف 10 نقاط', 'Refresh used 10 star points': 'تم استخدام 10 نقاط نجوم للتحديث', 'Male': 'ذكور', 'Female': 'إناث', 'Mixed': 'مختلط', 'New game': 'لعبة جديدة', 'How to play': 'طريقة اللعب', 'Reshuffled': 'أُعيد خلطه', 'No moves — reshuffled': 'لا حركات — أُعيد خلطه', 'Tap two adjacent tiles to swap': 'انقر على قطعتين متجاورتين لتبديلها', 'Swap back': 'تم التراجع عن التبديل', 'Combo': 'كومبو',
  },
}

export function matchText(zh: string, en: string): string {
  const lang = getLang()
  if (lang === 'zh') return zh
  if (lang === 'en') return en
  return TEXT[lang]?.[en] ?? en
}
