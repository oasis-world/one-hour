// 10-language UI strings for the open-world MUD (Tide Genesis).
// Region/room names reuse worldI18n (already 10-lang). Puzzle riddles
// are authored zh/en with en fallback for other langs.
import type { Lang } from '../../lib/i18n'

const T: Record<string, Record<Lang, string>> = {
  worldTitle: { zh: '潮汐启元', 'zh-TW': '潮汐啟元', en: 'Tide Genesis', ja: '潮汐啓元', fr: 'Genèse des Marées', es: 'Génesis de la Marea', de: 'Gezeiten-Genesis', ko: '조수 기원', it: 'Genesi della Marea', ar: 'تكوين المد' },
  worldSubtitle: { zh: '开放解谜修行世界 · 新人直达当前进度', 'zh-TW': '開放解謎修行世界 · 新人直達當前進度', en: 'Open puzzle-cultivation world · Newcomers land on current progress', ja: '開放型パズル修行ワールド · 新規参加者は現在の進捗へ', fr: 'Monde ouvert de puzzles et de culture · Les nouveaux arrivent au progrès actuel', es: 'Mundo abierto de puzzles y cultivo · Los nuevos llegan al progreso actual', de: 'Offene Rätsel-Kultivierungswelt · Neue Spieler landen im aktuellen Fortschritt', ko: '오픈 퍼즐 수련 세계 · 신규는 현재 진행도에 바로 착지', it: 'Mondo aperto di enigmi e coltivazione · I nuovi arrivano ai progressi attuali', ar: 'عالم مفتوح للألغاز والتزكية · الوافد الجديد يصل إلى التقدم الحالي مباشرة' },
  snapshotProgress: { zh: '世界进度', 'zh-TW': '世界進度', en: 'World progress', ja: '世界の進捗', fr: 'Progrès du monde', es: 'Progreso del mundo', de: 'Weltfortschritt', ko: '월드 진행도', it: 'Progressi del mondo', ar: 'تقدم العالم' },
  sealsBroken: { zh: '已破封印', 'zh-TW': '已破封印', en: 'Seals broken', ja: '破られた封印', fr: 'Sceaux brisés', es: 'Sellos rotos', de: 'Gebrochene Siegel', ko: '깨진 봉인', it: 'Sigilli rotti', ar: 'أختام مكسورة' },
  of: { zh: '/', 'zh-TW': '/', en: '/', ja: '/', fr: '/', es: '/', de: '/', ko: '/', it: '/', ar: '/' },
  phase: { zh: '世界阶段', 'zh-TW': '世界階段', en: 'Phase', ja: 'フェーズ', fr: 'Phase', es: 'Fase', de: 'Phase', ko: '단계', it: 'Fase', ar: 'المرحلة' },
  chronicle: { zh: '世界编年史', 'zh-TW': '世界編年史', en: 'World chronicle', ja: '世界編年史', fr: 'Chronique du monde', es: 'Crónica del mundo', de: 'Weltchronik', ko: '월드 연대기', it: 'Cronaca del mondo', ar: 'سجل العالم' },
  cultivation: { zh: '修行', 'zh-TW': '修行', en: 'Cultivation', ja: '修行', fr: 'Cultivation', es: 'Cultivo', de: 'Kultivierung', ko: '수련', it: 'Coltivazione', ar: 'التزكية' },
  realmLevel: { zh: '境界', 'zh-TW': '境界', en: 'Realm', ja: '境界', fr: 'Royaume', es: 'Reino', de: 'Rang', ko: '경지', it: 'Reame', ar: 'المرتبة' },
  xp: { zh: '汐力', 'zh-TW': '汐力', en: 'Tide XP', ja: '潮力', fr: 'XP marée', es: 'XP marea', de: 'Gezeiten-XP', ko: '조수 XP', it: 'XP marea', ar: 'خبرة المد' },
  equipment: { zh: '装备', 'zh-TW': '裝備', en: 'Equipment', ja: '装備', fr: 'Équipement', es: 'Equipo', de: 'Ausrüstung', ko: '장비', it: 'Equipaggiamento', ar: 'المعدات' },
  currentRoom: { zh: '当前位置', 'zh-TW': '當前位置', en: 'Current room', ja: '現在地', fr: 'Position actuelle', es: 'Posición actual', de: 'Aktueller Ort', ko: '현재 위치', it: 'Posizione attuale', ar: 'الموقع الحالي' },
  region: { zh: '汐域', 'zh-TW': '汐域', en: 'Tide region', ja: '汐域', fr: 'Région de marée', es: 'Región de marea', de: 'Gezeitenregion', ko: '조수 영역', it: 'Regione di marea', ar: 'منطقة المد' },
  look: { zh: '环顾', 'zh-TW': '環顧', en: 'Look', ja: '見回す', fr: 'Observer', es: 'Mirar', de: 'Umschauen', ko: '둘러보기', it: 'Osserva', ar: 'انظر' },
  map: { zh: '地图', 'zh-TW': '地圖', en: 'Map', ja: '地図', fr: 'Carte', es: 'Mapa', de: 'Karte', ko: '지도', it: 'Mappa', ar: 'الخريطة' },
  puzzlesHere: { zh: '此处谜题', 'zh-TW': '此處謎題', en: 'Puzzles here', ja: 'この場所のパズル', fr: 'Énigmes ici', es: 'Acertijos aquí', de: 'Rätsel hier', ko: '여기 퍼즐', it: 'Enigmi qui', ar: 'ألغاز هنا' },
  solved: { zh: '已破', 'zh-TW': '已破', en: 'Solved', ja: '解決済み', fr: 'Résolu', es: 'Resuelto', de: 'Gelöst', ko: '해결', it: 'Risolto', ar: 'محلول' },
  answerPlaceholder: { zh: '输入你的答案…', 'zh-TW': '輸入你的答案…', en: 'Enter your answer…', ja: '答えを入力…', fr: 'Votre réponse…', es: 'Tu respuesta…', de: 'Deine Antwort…', ko: '답 입력…', it: 'La tua risposta…', ar: 'أدخل إجابتك…' },
  submit: { zh: '解谜', 'zh-TW': '解謎', en: 'Solve', ja: '解く', fr: 'Résoudre', es: 'Resolver', de: 'Lösen', ko: '풀기', it: 'Risolvi', ar: 'حل' },
  hint: { zh: '提示', 'zh-TW': '提示', en: 'Hint', ja: 'ヒント', fr: 'Indice', es: 'Pista', de: 'Hinweis', ko: '힌트', it: 'Suggerimento', ar: 'تلميح' },
  reward: { zh: '奖励', 'zh-TW': '獎勵', en: 'Reward', ja: '報酬', fr: 'Récompense', es: 'Recompensa', de: 'Belohnung', ko: '보상', it: 'Ricompensa', ar: 'مكافأة' },
  correct: { zh: '破封成功！', 'zh-TW': '破封成功！', en: 'Seal broken!', ja: '封印を解いた！', fr: 'Sceau brisé !', es: '¡Sello roto!', de: 'Siegel gebrochen!', ko: '봉인 해제!', it: 'Sigillo rotto!', ar: 'تم كسر الختم!' },
  wrong: { zh: '尚未破封，再想想。', 'zh-TW': '尚未破封，再想想。', en: 'Not yet — think again.', ja: 'まだ解けていない。考え直そう。', fr: 'Pas encore — réfléchis.', es: 'Aún no — piensa de nuevo.', de: 'Noch nicht — überleg erneut.', ko: '아직 아니야 — 다시 생각해.', it: 'Non ancora — ripensaci.', ar: 'ليس بعد — فكّر مجدداً.' },
  genTaskTitle: { zh: '✦ 让 AI 生成任务', 'zh-TW': '✦ 讓 AI 生成任務', en: '✦ Generate task with AI', ja: '✦ AIでタスク生成', fr: '✦ Générer une tâche IA', es: '✦ Generar tarea con IA', de: '✦ KI-Aufgabe erstellen', ko: '✦ AI로 퀘스트 생성', it: '✦ Genera compito con IA', ar: '✦ توليد مهمة بالذكاء' },
  genTaskPlaceholder: { zh: '例：在雾隐森林生成一个找月光药草的支线任务…', 'zh-TW': '例：在霧隱森林生成一個找月光藥草的支線任務…', en: 'e.g. in Misty Forest: find moonlit herbs…', ja: '例：霧の森で月光の薬草を探す…', fr: 'ex. dans la Forêt Brumeuse : trouver des herbes lunaires…', es: 'ej. en Bosque Brumoso: buscar hierbas lunares…', de: 'z. B. im Nebelwald: Mondkräuter finden…', ko: '예: 안개 숲에서 달빛 약초 찾기…', it: 'es. nella Foresta Nebulosa: trova erbe lunari…', ar: 'مثال: في غابة الضباب ابحث عن أعشاب القمر…' },
  generate: { zh: '生成', 'zh-TW': '生成', en: 'Generate', ja: '生成', fr: 'Générer', es: 'Generar', de: 'Erstellen', ko: '생성', it: 'Genera', ar: 'توليد' },
  generatedTasks: { zh: '玩家生成的任务', 'zh-TW': '玩家生成的任務', en: 'Player-generated tasks', ja: 'プレイヤー生成タスク', fr: 'Tâches des joueurs', es: 'Tareas de jugadores', de: 'Spieler-Aufgaben', ko: '플레이어 생성 퀘스트', it: 'Compiti dei giocatori', ar: 'مهام اللاعبين' },
  askTitle: { zh: '✦ 守门人问答', 'zh-TW': '✦ 守門人問答', en: '✦ Ask the Guide', ja: '✦ ガイドに聞く', fr: '✦ Demander au Guide', es: '✦ Preguntar al Guía', de: '✦ Guide fragen', ko: '✦ 가이드에게 물어보기', it: '✦ Chiedi alla Guida', ar: '✦ اسأل المرشد' },
  askPlaceholder: { zh: '问进度、问谜题、问修行…', 'zh-TW': '問進度、問謎題、問修行…', en: 'Ask about progress, puzzles, cultivation…', ja: '進捗・パズル・修行を聞く…', fr: 'Pose une question sur le progrès, les énigmes…', es: 'Pregunta sobre progreso, acertijos…', de: 'Frage zu Fortschritt, Rätseln, Kultivierung…', ko: '진행도·퍼즐·수련에 대해 물어봐…', it: 'Chiedi di progressi, enigmi, coltivazione…', ar: 'اسأل عن التقدم والألغاز والتزكية…' },
  ask: { zh: '提问', 'zh-TW': '提問', en: 'Ask', ja: '聞く', fr: 'Demander', es: 'Preguntar', de: 'Fragen', ko: '질문', it: 'Chiedi', ar: 'اسأل' },
  onlineNow: { zh: '在线', 'zh-TW': '在線', en: 'online', ja: 'オンライン', fr: 'en ligne', es: 'en línea', de: 'online', ko: '온라인', it: 'in linea', ar: 'متصل' },
  leaderboard: { zh: '修行榜', 'zh-TW': '修行榜', en: 'Cultivation rank', ja: '修行ランキング', fr: 'Classement', es: 'Clasificación', de: 'Rangliste', ko: '수련 순위', it: 'Classifica', ar: 'ترتيب التزكية' },
  noLogYet: { zh: '世界等待第一位使徒…', 'zh-TW': '世界等待第一位使徒…', en: 'The world awaits the first apostle…', ja: '世界は最初の使徒を待っています…', fr: 'Le monde attend le premier apôtre…', es: 'El mundo espera al primer apóstol…', de: 'Die Welt wartet auf den ersten Apostel…', ko: '세상은 첫 사도를 기다리고 있어요…', it: 'Il mondo attende il primo apostolo…', ar: 'العالم بانتظار أول رسول…' },
  tabPuzzle: { zh: '🧩 谜', 'zh-TW': '🧩 謎', en: '🧩 Solve', ja: '🧩 解', fr: '🧩 Casse', es: '🧩 Acertijo', de: '🧩 Rätsel', ko: '🧩 퍼즐', it: '🧩 Enigma', ar: '🧩 لغز' },
  tabMap: { zh: '🗺️ 图', 'zh-TW': '🗺️ 圖', en: '🗺️ Map', ja: '🗺️ 図', fr: '🗺️ Carte', es: '🗺️ Mapa', de: '🗺️ Karte', ko: '🗺️ 지도', it: '🗺️ Mappa', ar: '🗺️ خريطة' },
  tabQuest: { zh: '✦ 任务', 'zh-TW': '✦ 任務', en: '✦ Quest', ja: '✦ 任務', fr: '✦ Quête', es: '✦ Misión', de: '✦ Aufgabe', ko: '✦ 퀘스트', it: '✦ Missione', ar: '✦ مهمة' },
  tabGuide: { zh: '💬 问', 'zh-TW': '💬 問', en: '💬 Guide', ja: '💬 質', fr: '💬 Guide', es: '💬 Guía', de: '💬 Guide', ko: '💬 가이드', it: '💬 Guida', ar: '💬 مرشد' },
  ownedGear: { zh: '已持有', 'zh-TW': '已持有', en: 'Owned', ja: '所持', fr: 'Possédées', es: 'Obtenidos', de: 'Im Besitz', ko: '보유', it: 'Posseduti', ar: 'مملوك' },
  loading: { zh: '正在链接当前世界进度…', 'zh-TW': '正在連結當前世界進度…', en: 'Linking current world progress…', ja: '現在の進捗を読み込んでいます…', fr: 'Connexion au progrès actuel…', es: 'Conectando al progreso actual…', de: 'Aktueller Fortschritt wird geladen…', ko: '현재 월드 진행도를 연결 중…', it: 'Collegamento ai progressi attuali…', ar: 'جاري الاتصال بالتقدم الحالي…' },
  offlineNote: { zh: '本地模式：进度保存在本机', 'zh-TW': '本地模式：進度保存在本機', en: 'Local mode: progress saved on this device', ja: 'ローカルモード：進捗はこの端末に保存', fr: 'Mode local : progression sur cet appareil', es: 'Modo local: progreso en este dispositivo', de: 'Lokalmodus: Fortschritt auf diesem Gerät', ko: '로컬 모드: 진행도는 이 기기에 저장', it: 'Modalità locale: progressi su questo dispositivo', ar: 'الوضع المحلي: التقدم محفوظ على هذا الجهاز' },
}

export function tOpen(lang: Lang, key: string): string {
  return T[key]?.[lang] ?? T[key]?.en ?? key
}
