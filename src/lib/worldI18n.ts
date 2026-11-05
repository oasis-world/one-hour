import type { Lang } from './i18n'
import type { WorldDistrict, WorldRoom } from '../games/mud/worldTypes'

type LangMap = Partial<Record<Lang, string>>

// District names — 8
const DISTRICTS: Record<string, LangMap> = {
  plaza:   { zh: '沙漏广场', 'zh-TW': '沙漏廣場', en: 'Hourglass Plaza', ja: '砂時計広場', fr: 'Place du Sablier', es: 'Plaza del Reloj', de: 'Sanduhr-Platz', ko: '모래시계 광장', it: 'Piazza della Clessidra', ar: 'ساحة الساعة' },
  ruin:    { zh: '低语遗迹', 'zh-TW': '低語遺跡', en: 'Whispering Ruins', ja: '囁きの遺跡', fr: 'Ruines Murmurantes', es: 'Ruinas Susurrantes', de: 'Flüsternde Ruinen', ko: '속삭이는 유적', it: 'Rovine Sussurranti', ar: 'أطلال الهمس' },
  lab:     { zh: '霓光实验室', 'zh-TW': '霓光實驗室', en: 'Neon Laboratory', ja: 'ネオン研究所', fr: 'Laboratoire Néon', es: 'Laboratorio Neón', de: 'Neon-Labor', ko: '네온 연구소', it: 'Laboratorio Neon', ar: 'مختبر النيون' },
  forest:  { zh: '雾隐森林', 'zh-TW': '霧隱森林', en: 'Misty Forest', ja: '霧隠れの森', fr: 'Forêt Brumeuse', es: 'Bosque Brumoso', de: 'Nebelwald', ko: '안개 숲', it: 'Foresta Nebbiosa', ar: 'غابة الضباب' },
  ocean:   { zh: '蔚蓝深渊', 'zh-TW': '蔚藍深淵', en: 'Azure Depths', ja: '紺碧の深淵', fr: 'Profondeurs Azur', es: 'Profundidades Azules', de: 'Azurtiefen', ko: '푸른 심연', it: 'Profondità Azzurre', ar: 'الأعماق اللازوردية' },
  city:    { zh: '霓虹街区', 'zh-TW': '霓虹街區', en: 'Neon District', ja: 'ネオン街', fr: 'Quartier Néon', es: 'Distrito Neón', de: 'Neon-Viertel', ko: '네온 지구', it: 'Quartiere Neon', ar: 'حي النيون' },
  tavern:  { zh: '归人酒馆', 'zh-TW': '歸人酒館', en: 'Hearth Tavern', ja: '憩いの酒場', fr: 'Taverne du Foyer', es: 'Taberna del Hogar', de: 'Herd-Taverne', ko: '난로 선술집', it: 'Taverna del Focolare', ar: 'حانة الموقد' },
  academy: { zh: '星辰学院', 'zh-TW': '星辰學院', en: 'Astral Academy', ja: '星辰学院', fr: 'Académie Astrale', es: 'Academia Astral', de: 'Astral-Akademie', ko: '별빛 학원', it: 'Accademia Astrale', ar: 'الأكاديمية النجمية' },
}

// Rooms — 37
const ROOMS: Record<string, LangMap> = {
  plaza_center:    { zh: '沙漏核心', 'zh-TW': '沙漏核心', en: 'Hourglass Core', ja: '砂時計の核心', fr: 'Cœur du Sablier', es: 'Núcleo del Reloj', de: 'Sanduhr-Kern', ko: '모래시계 핵', it: 'Nucleo della Clessidra', ar: 'قلب الساعة' },
  plaza_north:     { zh: '星辰大道', 'zh-TW': '星辰大道', en: 'Starlight Avenue', ja: '星光大通り', fr: 'Avenue Stellaire', es: 'Avenida Estelar', de: 'Sternenallee', ko: '별빛 대로', it: 'Viale Stellare', ar: 'جادة النجوم' },
  plaza_south:     { zh: '暮色码头', 'zh-TW': '暮色碼頭', en: 'Dusk Wharf', ja: '黄昏の波止場', fr: 'Quai du Crépuscule', es: 'Muelle del Ocaso', de: 'Dämmerungskai', ko: '황혼 부두', it: 'Molo del Tramonto', ar: 'رصيف الغسق' },
  plaza_east:      { zh: '霓虹入口', 'zh-TW': '霓虹入口', en: 'Neon Gate', ja: 'ネオン門', fr: 'Porte Néon', es: 'Puerta Neón', de: 'Neon-Tor', ko: '네온 관문', it: 'Portale Neon', ar: 'بوابة النيون' },
  plaza_west:      { zh: '古道岔口', 'zh-TW': '古道岔口', en: 'Old Trail Fork', ja: '古道の分岐', fr: 'Bifurcation du Vieux Chemin', es: 'Bifurcación del Viejo Camino', de: 'Alte Weggabel', ko: '옛길 갈림길', it: 'Bivio del Vecchio Sentiero', ar: 'مفترق الدرب القديم' },
  ruin_gate:       { zh: '遗迹大门', 'zh-TW': '遺跡大門', en: 'Ruins Gate', ja: '遺跡の大門', fr: 'Porte des Ruines', es: 'Puerta de Ruinas', de: 'Ruinentor', ko: '유적 관문', it: 'Porta delle Rovine', ar: 'بوابة الأطلال' },
  ruin_hall:       { zh: '回声大厅', 'zh-TW': '回聲大廳', en: 'Echo Hall', ja: '回声の広間', fr: 'Salle des Échos', es: 'Sala del Eco', de: 'Echohalle', ko: '메아리 홀', it: 'Sala degli Echi', ar: 'قاعة الصدى' },
  ruin_library:    { zh: '尘封书库', 'zh-TW': '塵封書庫', en: 'Dusty Archive', ja: '埃まみれの書庫', fr: 'Archives Poussiéreuses', es: 'Archivo Polvoriento', de: 'Staubiges Archiv', ko: '먼지 낀 서고', it: 'Archivio Polveroso', ar: 'الأرشيف المغبر' },
  ruin_pit:        { zh: '深渊裂隙', 'zh-TW': '深淵裂隙', en: 'Abyss Rift', ja: '深淵の裂け目', fr: 'Faille Abyssale', es: 'Grieta Abisal', de: 'Abyss-Riss', ko: '심연 균열', it: 'Fenditura Abissale', ar: 'صدع الهاوية' },
  ruin_throne:     { zh: '王座之间', 'zh-TW': '王座之間', en: 'Throne Room', ja: '玉座の間', fr: 'Salle du Trône', es: 'Sala del Trono', de: 'Thronsaal', ko: '옥좌의 방', it: 'Sala del Trono', ar: 'قاعة العرش' },
  lab_lobby:       { zh: '大厅', 'zh-TW': '大廳', en: 'Lobby', ja: 'ロビー', fr: 'Hall', es: 'Vestíbulo', de: 'Lobby', ko: '로비', it: 'Atrio', ar: 'الردهة' },
  lab_a:           { zh: '实验区A', 'zh-TW': '實驗區A', en: 'Lab A', ja: '実験区A', fr: 'Labo A', es: 'Lab A', de: 'Labor A', ko: '실험구역 A', it: 'Lab A', ar: 'مختبر A' },
  lab_greenhouse:  { zh: '生态温室', 'zh-TW': '生態溫室', en: 'Greenhouse', ja: '温室', fr: 'Serre', es: 'Invernadero', de: 'Gewächshaus', ko: '온실', it: 'Serra', ar: 'الدفيئة' },
  lab_core:        { zh: '核心反应炉', 'zh-TW': '核心反應爐', en: 'Reactor Core', ja: '炉心', fr: 'Cœur du Réacteur', es: 'Núcleo del Reactor', de: 'Reaktorkern', ko: '원자로 노심', it: 'Nucleo del Reattore', ar: 'قلب المفاعل' },
  forest_trail:    { zh: '林间小径', 'zh-TW': '林間小徑', en: 'Forest Trail', ja: '森の小道', fr: 'Sentier Forestier', es: 'Sendero del Bosque', de: 'Waldpfad', ko: '숲길', it: 'Sentiero nella Foresta', ar: 'درب الغابة' },
  forest_lake:     { zh: '月光湖', 'zh-TW': '月光湖', en: 'Moon Lake', ja: '月光の湖', fr: 'Lac Lunaire', es: 'Lago Lunar', de: 'Mondsee', ko: '달빛 호수', it: 'Lago di Luna', ar: 'بحيرة القمر' },
  forest_cabin:    { zh: '猎人小屋', 'zh-TW': '獵人小屋', en: 'Hunter Cabin', ja: '猟師の小屋', fr: 'Cabane du Chasseur', es: 'Cabaña del Cazador', de: 'Jägerhütte', ko: '사냥꾼 오두막', it: 'Capanna del Cacciatore', ar: 'كوخ الصياد' },
  forest_shrine:   { zh: '古老神祠', 'zh-TW': '古老神祠', en: 'Old Shrine', ja: '古い祠', fr: 'Vieux Sanctuaire', es: 'Antiguo Santuario', de: 'Alter Schrein', ko: '오래된 신사', it: 'Antico Santuario', ar: 'المزار القديم' },
  forest_heart:    { zh: '森林之心', 'zh-TW': '森林之心', en: 'Heart of Forest', ja: '森の心', fr: 'Cœur de la Forêt', es: 'Corazón del Bosque', de: 'Herz des Waldes', ko: '숲의 심장', it: 'Cuore della Foresta', ar: 'قلب الغابة' },
  ocean_shore:     { zh: '礁海岸', 'zh-TW': '礁海岸', en: 'Reef Shore', ja: '岩礁海岸', fr: 'Rivage Récifal', es: 'Costa Arrecife', de: 'Riffküste', ko: '암초 해안', it: 'Costa della Scogliera', ar: 'ساحل الشعاب' },
  ocean_cave:      { zh: '潮汐洞窟', 'zh-TW': '潮汐洞窟', en: 'Tide Cave', ja: '潮の洞窟', fr: 'Grotte des Marées', es: 'Cueva de Marea', de: 'Gezeitenhöhle', ko: '조수 동굴', it: 'Grotta delle Maree', ar: 'كهف المد' },
  ocean_wreck:     { zh: '沉没巨轮', 'zh-TW': '沉沒巨輪', en: 'Sunken Wreck', ja: '沈没船', fr: 'Épave Engloutie', es: 'Pecio Hundido', de: 'Versunkenes Wrack', ko: '침몰한 난파선', it: 'Relitto Affondato', ar: 'حطام غارق' },
  ocean_trench:    { zh: '深海海沟', 'zh-TW': '深海海溝', en: 'Abyss Trench', ja: '深海の海溝', fr: 'Fosse Abyssale', es: 'Fosa Abisal', de: 'Tiefseegraben', ko: '심해 해구', it: 'Fossa Abissale', ar: 'خندق الهاوية' },
  ocean_palace:    { zh: '海底宫殿', 'zh-TW': '海底宮殿', en: 'Sea Palace', ja: '海底宮殿', fr: 'Palais Marin', es: 'Palacio Marino', de: 'Meerespalast', ko: '해저 궁전', it: 'Palazzo Marino', ar: 'قصر البحر' },
  city_alley:      { zh: '雨巷', 'zh-TW': '雨巷', en: 'Rain Alley', ja: '雨の路地', fr: 'Ruelle Pluvieuse', es: 'Callejón Lluvioso', de: 'Regengasse', ko: '비 골목', it: 'Vicolo della Pioggia', ar: 'زقاق المطر' },
  city_market:     { zh: '夜市', 'zh-TW': '夜市', en: 'Night Market', ja: '夜市', fr: 'Marché Nocturne', es: 'Mercado Nocturno', de: 'Nachtmarkt', ko: '야시장', it: 'Mercato Notturno', ar: 'السوق الليلي' },
  city_rooftop:    { zh: '天台', 'zh-TW': '天台', en: 'Rooftop', ja: '屋上', fr: 'Toit', es: 'Azotea', de: 'Dachterrasse', ko: '옥상', it: 'Terrazza', ar: 'السطح' },
  city_club:       { zh: '地下俱乐部', 'zh-TW': '地下俱樂部', en: 'Underground Club', ja: '地下クラブ', fr: 'Club Souterrain', es: 'Club Subterráneo', de: 'Untergrund-Club', ko: '지하 클럽', it: 'Club Sotterraneo', ar: 'نادي تحت الأرض' },
  city_vault:      { zh: '金库', 'zh-TW': '金庫', en: 'Vault', ja: '金庫', fr: 'Coffre', es: 'Bóveda', de: 'Tresor', ko: '금고', it: 'Caveau', ar: 'الخزنة' },
  tavern_door:     { zh: '酒馆门前', 'zh-TW': '酒館門前', en: 'Tavern Door', ja: '酒場の前', fr: 'Porte de la Taverne', es: 'Puerta de Taberna', de: 'Tavernentür', ko: '선술집 문 앞', it: 'Porta della Taverna', ar: 'باب الحانة' },
  tavern_hall:     { zh: '喧闹大厅', 'zh-TW': '喧鬧大廳', en: 'Tavern Hall', ja: '酒場の広間', fr: 'Salle de Taverne', es: 'Sala de Taberna', de: 'Tavernensaal', ko: '선술집 홀', it: 'Sala della Taverna', ar: 'صالة الحانة' },
  tavern_cellar:   { zh: '酒窖密道', 'zh-TW': '酒窖密道', en: 'Cellar Passage', ja: '地下貯蔵庫', fr: 'Passage de Cave', es: 'Pasaje del Sótano', de: 'Kellergang', ko: '지하 저장고 통로', it: 'Passaggio della Cantina', ar: 'ممر القبو' },
  tavern_attic:    { zh: '阁楼密室', 'zh-TW': '閣樓密室', en: 'Attic Secret', ja: '屋根裏の隠し部屋', fr: 'Grenier Secret', es: 'Ático Secreto', de: 'Dachboden-Geheimnis', ko: '다락 비밀방', it: 'Soffitta Segreta', ar: 'علية سرية' },
  academy_gate:    { zh: '学院正门', 'zh-TW': '學院正門', en: 'Academy Gate', ja: '学院の正門', fr: 'Portail de l’Académie', es: 'Puerta de Academia', de: 'Akademietor', ko: '학원 정문', it: 'Cancello dell’Accademia', ar: 'بوابة الأكاديمية' },
  academy_library: { zh: '星图图书馆', 'zh-TW': '星圖圖書館', en: 'Star Library', ja: '星図図書館', fr: 'Bibliothèque Stellaire', es: 'Biblioteca Estelar', de: 'Sternbibliothek', ko: '별지도 도서관', it: 'Biblioteca Stellare', ar: 'مكتبة النجوم' },
  academy_tower:   { zh: '观星塔', 'zh-TW': '觀星塔', en: 'Observatory', ja: '天文台', fr: 'Observatoire', es: 'Observatorio', de: 'Observatorium', ko: '천문대', it: 'Osservatorio', ar: 'المرصد' },
  academy_lab:     { zh: '炼金工坊', 'zh-TW': '煉金工坊', en: 'Alchemy Lab', ja: '錬金工房', fr: 'Atelier d’Alchimie', es: 'Taller de Alquimia', de: 'Alchemie-Labor', ko: '연금술 공방', it: 'Laboratorio Alchemico', ar: 'مختبر الخيمياء' },
  academy_vault:   { zh: '禁书库', 'zh-TW': '禁書庫', en: 'Forbidden Vault', ja: '禁書庫', fr: 'Voûte Interdite', es: 'Bóveda Prohibida', de: 'Verbotenes Gewölbe', ko: '금지된 서고', it: 'Volta Proibita', ar: 'القبو المحرم' },
}

const LORE_TITLES: LangMap = { zh: '永恒沙漏', 'zh-TW': '永恆沙漏', en: 'The Eternal Hourglass', ja: '永遠の砂時計', fr: 'Le Sablier Éternel', es: 'El Reloj de Arena Eterno', de: 'Die Ewige Sanduhr', ko: '영원한 모래시계', it: 'La Clessidra Eterna', ar: 'الساعة الرملية الأبدية' }
const LORES: LangMap = { zh: '在这座被时间遗忘的城市里，每个人都只有一小时。沙漏永不停止流转，而世界因每一个抵达的灵魂而悄然改变。没有注定的结局，只有你们共同书写的历史。', 'zh-TW': '在這座被時間遺忘的城市裡，每個人都只有一小時。沙漏永不停止流轉，而世界因每一個抵達的靈魂而悄然改變。', en: 'In a city forgotten by time, each soul has but one hour. The hourglass never stops, and the world shifts with every arrival.', ja: '時が忘れた街、一人ひとりに一時間。砂時計は止まらず、世界は訪れる魂ごとに変わる。', fr: 'Dans une ville oubliée du temps, chaque âme n’a qu’une heure. Le sablier ne s’arrête jamais.', es: 'En una ciudad olvidada por el tiempo, cada alma tiene una hora. El reloj nunca se detiene.', de: 'In einer vom Zeit vergessenen Stadt hat jede Seele nur eine Stunde. Die Sanduhr stoppt nie.', ko: '시간이 잊은 도시, 각 영혼에게는 한 시간뿐. 모래시계는 멈추지 않는다.', it: 'In una città dimenticata dal tempo, ogni anima ha un’ora. La clessidra non si ferma mai.', ar: 'في مدينة نسيها الزمن، لكل روح ساعة واحدة. الساعة الرملية لا تتوقف أبداً.' }
const MOTDS: LangMap = { zh: '沙漏刚刚翻转，新的故事等待被书写。', 'zh-TW': '沙漏剛剛翻轉，新的故事等待被書寫。', en: 'The hourglass has turned anew. A new story awaits.', ja: '砂時計が新たに返った。新しい物語が待っている。', fr: 'Le sablier vient de se retourner. Une nouvelle histoire attend.', es: 'El reloj acaba de girar. Una nueva historia espera.', de: 'Die Sanduhr hat sich erneut gedreht. Eine neue Geschichte wartet.', ko: '모래시계가 새로 뒤집혔다. 새로운 이야기가 기다린다.', it: 'La clessidra si è appena capovolta. Una nuova storia attende.', ar: 'انقلبت الساعة للتو. قصة جديدة بانتظارك.' }

export function districtNameOf(id: string, lang: Lang): string { return DISTRICTS[id]?.[lang] ?? DISTRICTS[id]?.en ?? id }
export function roomNameOf(id: string, lang: Lang): string { return ROOMS[id]?.[lang] ?? ROOMS[id]?.en ?? id }
export function loreTitleOf(lang: Lang): string { return LORE_TITLES[lang] ?? LORE_TITLES.en! }
export function loreOf(lang: Lang): string { return LORES[lang] ?? LORES.en! }
export function motdOf(lang: Lang): string { return MOTDS[lang] ?? MOTDS.en! }

const DISTRICT_DESCS: Record<string, LangMap> = {
  plaza:   { zh: '时间的十字路口，所有灵魂在此降临与告别', 'zh-TW': '時間的十字路口，所有靈魂在此降臨與告別', en: 'The crossroads of time, where every soul arrives and departs', ja: '時の交差点、すべての魂がここで出会い別れる', fr: 'Le carrefour du temps, où chaque âme arrive et part', es: 'La encrucijada del tiempo, donde cada alma llega y se despide', de: 'Der Kreuzweg der Zeit, wo jede Seele ankommt und geht', ko: '시간의 교차로, 모든 영혼이 이곳에서 만나고 헤어진다', it: 'Il crocevia del tempo, dove ogni anima arriva e parte', ar: 'مفترق الزمن، حيث تصل كل روح وتغادر' },
  ruin:    { zh: '被遗忘王朝的回声，埋藏着时间的秘密', 'zh-TW': '被遺忘王朝的回聲，埋藏著時間的秘密', en: 'Echoes of a forgotten dynasty, secrets buried in time', ja: '忘れられた王朝の残響、時に埋もれた秘密', fr: 'Échos d’une dynastie oubliée, secrets enfouis dans le temps', es: 'Ecos de una dinastía olvidada, secretos enterrados en el tiempo', de: 'Echos einer vergessenen Dynastie, Geheimnisse begraben in der Zeit', ko: '잊힌 왕조의 메아리, 시간 속에 묻힌 비밀', it: 'Echi di una dinastia dimenticata, segreti sepolti nel tempo', ar: 'أصداء سلالة منسية، أسرار مدفونة في الزمن' },
  lab:     { zh: '废弃的时空实验场，机器仍在低鸣', 'zh-TW': '廢棄的時空實驗場，機器仍在低鳴', en: 'An abandoned spacetime lab, machines still humming low', ja: '廃棄された時空実験場、機械は今も低く唸る', fr: 'Un labo spatio-temporel abandonné, les machines bourdonnent encore', es: 'Un laboratorio espacio-temporal abandonado, las máquinas aún zumban', de: 'Ein verlassenes Raumzeit-Labor, Maschinen summen leise', ko: '버려진 시공간 실험실, 기계들은 아직 낮은 웅음을 낸다', it: 'Un laboratorio spaziotemporale abbandonato, le macchine ronzano ancora', ar: 'مختبر زمكاني مهجور، الآلات لا تزال تهمهم' },
  forest:  { zh: '永恒之雾笼罩，古树记得每个过客的名字', 'zh-TW': '永恆之霧籠罩，古樹記得每個過客的名字', en: 'Veiled in eternal mist, ancient trees remember every passerby', ja: '永遠の霧に包まれ、古木は通り過ぎる者すべてを覚えている', fr: 'Voilée de brume éternelle, les arbres anciens se souviennent de chaque passant', es: 'Velado en niebla eterna, los árboles antiguos recuerdan a cada transeúnte', de: 'In ewigem Nebel gehüllt, erinnern sich uralte Bäume an jeden Vorübergehenden', ko: '영원한 안개에 싸여, 고목은 지나가는 모든 이를 기억한다', it: 'Avvolta in nebbia eterna, gli alberi antichi ricordano ogni passante', ar: 'يكتنفها ضباب أبدي، الأشجار العتيقة تتذكر كل عابر' },
  ocean:   { zh: '潮汐吞没的古文明，海底宫殿仍在呼吸', 'zh-TW': '潮汐吞沒的古文明，海底宮殿仍在呼吸', en: 'A drowned ancient civilization, its undersea palace still breathing', ja: '潮に呑まれた古代文明、海底宮殿は今も息づく', fr: 'Une civilisation engloutie, son palais sous-marin respire encore', es: 'Una civilización anegada, su palacio submarino aún respira', de: 'Eine versunkene Zivilisation, ihr Unterwasserpalast atmet noch', ko: '파도에 잠긴 고대 문명, 해저 궁전은 아직 숨쉰다', it: 'Un’antica civiltà sommersa, il suo palazzo sottomarino respira ancora', ar: 'حضارة غارقة، قصرها تحت البحر لا يزال يتنفس' },
  city:    { zh: '永不熄灭的雨夜霓虹，情报与危险同样密集', 'zh-TW': '永不熄滅的雨夜霓虹，情報與危險同樣密集', en: 'Neon that never sleeps in the rainy night — intel and danger in equal measure', ja: '雨夜に消えぬネオン、情報と危険が等しく渦巻く', fr: 'Néons qui ne dorment jamais sous la pluie — infos et dangers à parts égales', es: 'Neón que nunca duerme en la noche lluviosa — información y peligro por igual', de: 'Neon, das in der Regennacht nie schläft — Infos und Gefahr gleichermaßen', ko: '비 오는 밤 꺼지지 않는 네온, 정보와 위험이 equally 밀집', it: 'Neon che non dorme mai nella notte di pioggia — informazioni e pericoli in egual misura', ar: 'نيون لا ينام في الليل الماطر — معلومات وخطر بالتساوي' },
  tavern:  { zh: '所有故事的起点与终点，炉火永不熄灭', 'zh-TW': '所有故事的起點與終點，爐火永不熄滅', en: 'Where every story begins and ends, the hearth never goes out', ja: 'すべての物語が始まり終わる場所、炉の火は決して消えない', fr: 'Où chaque histoire commence et finit, l’âtre ne s’éteint jamais', es: 'Donde cada historia comienza y termina, el hogar nunca se apaga', de: 'Wo jede Geschichte beginnt und endet, erlischt das Herdfeuer nie', ko: '모든 이야기가 시작되고 끝나는 곳, 난로의 불은 꺼지지 않는다', it: 'Dove ogni storia inizia e finisce, il focolare non si spegne mai', ar: 'حيث تبدأ كل قصة وتنتهي، الموقد لا ينطفئ أبداً' },
  academy: { zh: '漂浮的星图与禁忌知识，学者们追逐永恒', 'zh-TW': '漂浮的星圖與禁忌知識，學者們追逐永恆', en: 'Floating star maps and forbidden knowledge, where scholars chase eternity', ja: '浮かぶ星図と禁断の知識、学者たちは永遠を追う', fr: 'Cartes stellaires flottantes et savoir interdit, où les érudits traquent l’éternité', es: 'Mapas estelares flotantes y conocimiento prohibido, donde los eruditos persiguen la eternidad', de: 'Schwebende Sternkarten und verbotenes Wissen, wo Gelehrte der Ewigkeit nachjagen', ko: '떠다니는 별 지도와 금단의 지식, 학자들이 영원을 쫓는 곳', it: 'Mappe stellari fluttuanti e conoscenza proibita, dove gli studiosi inseguono l’eternità', ar: 'خرائط نجمية عائمة ومعرفة محرمة، حيث يطارد العلماء الخلود' },
}

// Helpers that work directly with domain objects
export function getDistrictName(d: WorldDistrict, lang: Lang): string { return districtNameOf(d.id, lang) }
export function getRoomName(r: WorldRoom, lang: Lang): string { return roomNameOf(r.id, lang) }
export function getDistrictDesc(d: WorldDistrict, lang: Lang): string { return DISTRICT_DESCS[d.id]?.[lang] ?? DISTRICT_DESCS[d.id]?.en ?? d.descriptionEn }

