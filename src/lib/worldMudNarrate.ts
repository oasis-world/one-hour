/**
 * World MUD narration — Baseten LLM + deterministic fallback.
 * Supports both freeform natural language and button actions.
 */
import { getSupabaseClient } from './supabaseClient'
import { isSupabaseConfigured } from './supabaseConfig'
import type { WorldMudState, WorldMudScene, WorldLogEntry } from '../games/mud/worldTypes'
import { findRoom, findDistrict } from '../games/mud/worldTypes'
import { getLang } from './i18n'

export interface NarrateRequest {
  actionText: string
  locationId: string
  player: { displayName: string; role: string }
  lang: string
  recentLog: WorldLogEntry[]
  globalEvent?: string | null
}

export interface NarrateResponse {
  narrative: string
  choices: Array<{ label: string; action: string; icon?: string }>
  hint?: string
  broadcast: string
}

const COMMAND_ALIASES: Record<string, string> = {
  l: 'look', look: 'look', 看看: 'look', 观察: 'look',
  n: 'go north', north: 'go north', 北: 'go north', go: 'go',
  s: 'go south', south: 'go south', 南: 'go south',
  e: 'go east', east: 'go east', 东: 'go east',
  w: 'go west', west: 'go west', 西: 'go west',
  i: 'inventory', inv: 'inventory', 背包: 'inventory',
  h: 'help', help: 'help', 帮助: 'help',
}

function normalizeCommand(raw: string): string {
  const t = raw.trim().toLowerCase()
  return COMMAND_ALIASES[t] ?? raw.trim()
}

function fallbackChoices(lang: string, locationId: string, world: WorldMudState): Array<{ label: string; action: string; icon?: string }> {
  const room = findRoom(world, locationId)
  const isZh = lang.startsWith('zh')
  const exits = room ? Object.entries(room.exits) : []
  const choices: Array<{ label: string; action: string; icon?: string }> = []
  if (isZh) {
    choices.push({ label: '观察四周', action: 'look', icon: '👁️' })
    for (const [dir, target] of exits.slice(0, 2)) {
      const targetRoom = findRoom(world, target)
      const dirZh = dir === 'north' ? '北' : dir === 'south' ? '南' : dir === 'east' ? '东' : '西'
      choices.push({ label: `前往${targetRoom?.name ?? dirZh}`, action: `go ${dir}`, icon: '🚶' })
    }
    if (choices.length < 3) choices.push({ label: '与人交谈', action: 'talk', icon: '💬' })
    if (choices.length < 4) choices.push({ label: '搜索', action: 'search', icon: '🔍' })
  } else {
    const dirEn: Record<string, string> = { north: 'North', south: 'South', east: 'East', west: 'West' }
    choices.push({ label: 'Look around', action: 'look', icon: '👁️' })
    for (const [dir, target] of exits.slice(0, 2)) {
      const targetRoom = findRoom(world, target)
      choices.push({ label: `Go ${dirEn[dir] ?? dir} → ${targetRoom?.nameEn ?? dir}`, action: `go ${dir}`, icon: '🚶' })
    }
    if (choices.length < 3) choices.push({ label: 'Talk', action: 'talk', icon: '💬' })
    if (choices.length < 4) choices.push({ label: 'Search', action: 'search', icon: '🔍' })
  }
  return choices.slice(0, 4)
}

function localFallbackNarrate(req: NarrateRequest, world: WorldMudState): NarrateResponse {
  const isZh = req.lang.startsWith('zh')
  const action = normalizeCommand(req.actionText)
  const room = findRoom(world, req.locationId)
  const district = room ? findDistrict(world, room.districtId) : null
  const actLower = action.toLowerCase()

  if (actLower.startsWith('go ')) {
    const dir = actLower.slice(3).trim()
    const targetId = room?.exits[dir]
    if (targetId) {
      const target = findRoom(world, targetId)
      if (isZh) {
        return {
          narrative: `你沿着${dir === 'north' ? '北' : dir === 'south' ? '南' : dir === 'east' ? '东' : '西'}方前行，来到${target?.name ?? '未知之地'}。${target ? findDistrict(world, target.districtId)?.description ?? '' : ''} 空气中弥漫着新的气息。`,
          choices: fallbackChoices(req.lang, targetId, world),
          hint: isZh ? `已移动到 ${target?.name}` : `Moved to ${target?.nameEn}`,
          broadcast: isZh ? `前往了 ${target?.name}` : `traveled to ${target?.nameEn}`,
        }
      }
      return {
        narrative: `You head ${dir} and arrive at ${target?.nameEn ?? 'unknown'}. ${findDistrict(world, target?.districtId ?? 'plaza')?.description ?? ''} The air feels different here.`,
        choices: fallbackChoices(req.lang, targetId, world),
        hint: `Moved to ${target?.nameEn}`,
        broadcast: `traveled to ${target?.nameEn}`,
      }
    }
    return {
      narrative: isZh ? `此路不通。试试其他方向，或使用“观察”了解出口。` : `You can't go that way. Try another direction or "look" to see exits.`,
      choices: fallbackChoices(req.lang, req.locationId, world),
      broadcast: isZh ? '尝试移动但碰壁了' : 'tried to move but hit a wall',
    }
  }

  if (actLower === 'look' || actLower === 'l') {
    const exits = room ? Object.entries(room.exits).map(([d]) => d).join(', ') : '—'
    const dDesc = isZh ? (district?.description ?? '') : (district?.descriptionEn ?? '')
    const dName = isZh ? (district?.name ?? '') : (district?.nameEn ?? '')
    const rName = isZh ? (room?.name ?? '未知之地') : (room?.nameEn ?? 'Unknown')
    if (isZh) {
      return {
        narrative: `你在${dName}·${rName}。${dDesc} 你注意到：${room?.danger ? '空气中有一丝紧张感。' : '这里相对平静。'} 出口：${exits || '无'}。`,
        choices: fallbackChoices(req.lang, req.locationId, world),
        broadcast: '环顾四周',
      }
    }
    return {
      narrative: `You are at ${dName} — ${rName}. ${dDesc} ${room?.danger ? 'There is a faint tension in the air.' : 'It feels relatively calm.'} Exits: ${exits || 'none'}.`,
      choices: fallbackChoices(req.lang, req.locationId, world),
      broadcast: 'looked around',
    }
  }

  if (actLower === 'talk') {
    const rName = isZh ? (room?.name ?? '这里') : (room?.nameEn ?? 'here')
    if (isZh) {
      return {
        narrative: `你在${rName}与人攀谈。炉火噼啪、酒杯轻碰，陌生人递来一个眼神——关于${district?.name ?? '这片街区'}的传闻正悄悄流传。你感到自己正在融入这个世界。`,
        choices: fallbackChoices(req.lang, req.locationId, world),
        broadcast: '与人交谈',
      }
    }
    return {
      narrative: `You strike up a conversation at ${rName}. A stranger leans in, sharing a rumor about ${district?.nameEn ?? 'this district'}. You feel a little more at home here.`,
      choices: fallbackChoices(req.lang, req.locationId, world),
      broadcast: 'chatted with someone',
    }
  }
  if (actLower === 'search') {
    const rName = isZh ? (room?.name ?? '这里') : (room?.nameEn ?? 'here')
    if (isZh) {
      return {
        narrative: `你在${rName}仔细搜索，指尖划过石缝与旧木，竟然找到一枚发亮的碎片——沙漏的光在它表面流动，像是有人刻意留下的记号。`,
        choices: fallbackChoices(req.lang, req.locationId, world),
        broadcast: '搜索了一番',
      }
    }
    return {
      narrative: `You search ${rName} carefully and uncover a glinting shard — the hourglass light swims across it, as if someone left it for you.`,
      choices: fallbackChoices(req.lang, req.locationId, world),
      broadcast: 'searched the area',
    }
  }
  if (actLower === 'inventory' || actLower === 'inv' || actLower === '背包') {
    if (isZh) {
      return { narrative: `你打开背包：里面只有一小时旅人标配——一枚沙漏、一张发黄的便条，写着“别忘了，你是来写故事的”。`, choices: fallbackChoices(req.lang, req.locationId, world), broadcast: '查看了背包' }
    }
    return { narrative: `You check your pack: an hourglass and a yellowed note — “remember, you’re here to write a story.”`, choices: fallbackChoices(req.lang, req.locationId, world), broadcast: 'checked inventory' }
  }
  if (actLower === 'help') {
    if (isZh) {
      return { narrative: `提示：你可以直接用自然语言描述想做的事（如“和酒馆老板聊聊”），或用传统指令 look / go north / talk / search。点地图可快速跳转相邻区域。`, choices: fallbackChoices(req.lang, req.locationId, world), broadcast: '请求了帮助' }
    }
    return { narrative: `Tip: just describe what you want to do in natural language, or use classic commands: look / go north / talk / search. Tap the map to jump to nearby rooms.`, choices: fallbackChoices(req.lang, req.locationId, world), broadcast: 'asked for help' }
  }

  const dName2 = isZh ? (district?.name ?? '') : (district?.nameEn ?? '')
  const rName2 = isZh ? (room?.name ?? '') : (room?.nameEn ?? '')
  if (isZh) {
    return {
      narrative: `你说道：“${req.actionText}” —— 世界仿佛听见了。${room ? `在${dName2}·${rName2}，你的行动引起了微妙的变化。` : ''} 前方似乎有新的可能在等待。`,
      choices: fallbackChoices(req.lang, req.locationId, world),
      broadcast: req.actionText.slice(0, 40),
    }
  }
  return {
    narrative: `You say: "${req.actionText}" — the world seems to listen. ${room ? `At ${dName2} — ${rName2}, your action stirs subtle changes.` : ''} New possibilities await ahead.`,
    choices: fallbackChoices(req.lang, req.locationId, world),
    broadcast: req.actionText.slice(0, 40),
  }
}

export async function requestWorldNarrate(req: NarrateRequest, world: WorldMudState): Promise<NarrateResponse> {
  const action = normalizeCommand(req.actionText)
  const room = findRoom(world, req.locationId)
  const district = room ? findDistrict(world, room.districtId) : null

  if (!isSupabaseConfigured()) {
    return localFallbackNarrate(req, world)
  }

  try {
    const client = await getSupabaseClient()
    const { data, error } = await client.functions.invoke('world-mud-narrate', {
      body: {
        actionText: action,
        locationId: req.locationId,
        districtId: district?.id ?? 'plaza',
        roomName: room?.nameEn ?? room?.name ?? req.locationId,
        player: req.player,
        lang: req.lang,
        recentLog: req.recentLog.slice(-6),
        globalEvent: req.globalEvent ?? null,
      },
    })

    if (!error && data) {
      // Edge fallback carries _fallback marker — treat as failure and use local
      if ((data as Record<string, unknown>)._fallback) {
        return localFallbackNarrate(req, world)
      }
      const narrative = typeof data.narrative === 'string' ? data.narrative.trim() : ''
      const rawChoices = Array.isArray(data.choices) ? data.choices : []
      const broadcast = typeof data.broadcast === 'string' ? data.broadcast.trim() : action
      if (narrative && rawChoices.length >= 2) {
        const choices = rawChoices
          .filter((c: unknown) => c && typeof (c as { label?: unknown }).label === 'string' && typeof (c as { action?: unknown }).action === 'string')
          .slice(0, 4)
          .map((c: { label: string; action: string; icon?: string }) => ({ label: c.label.slice(0, 28), action: c.action.slice(0, 32), icon: c.icon }))
        if (choices.length >= 2) {
          return {
            narrative: narrative.slice(0, 800),
            choices,
            hint: typeof data.hint === 'string' ? data.hint.slice(0, 80) : undefined,
            broadcast: broadcast.slice(0, 60),
          }
        }
      }
    }
  } catch {
    // fall through to local
  }

  return localFallbackNarrate(req, world)
}

export function buildWorldScene(
  world: WorldMudState,
  locationId: string,
  narrative: string,
  choices: Array<{ label: string; action: string; icon?: string }>,
): WorldMudScene {
  const room = findRoom(world, locationId)
  const district = room ? findDistrict(world, room.districtId) : null
  const lang = getLang()
  return {
    locationId,
    locationName: room?.name ?? locationId,
    locationNameEn: room?.nameEn ?? locationId,
    districtId: (room?.districtId ?? 'plaza') as WorldMudState['districts'][number]['id'],
    narrative,
    choices,
    hint: lang.startsWith('zh') ? district?.description : district?.description,
    discovered: true,
  }
}

export const WORLD_MUD_I18N: Record<string, Record<string, string>> = {
  zh: {
    worldTitle: '永恒沙漏',
    worldSubtitle: '一个由所有人共同书写、永不落幕的世界',
    enterWorld: '踏入世界',
    yourRole: '你的身份',
    currentLocation: '当前位置',
    worldLog: '世界动态',
    onlineNow: '此刻在线',
    actionsCount: '次行动',
    playersEver: '位旅人曾来过',
    typePlaceholder: '输入你想做的任何事… 如：观察四周、往北走、和酒馆老板交谈',
    send: '行动',
    look: '观察',
    inventory: '背包',
    map: '地图',
    district: '区域',
    danger: '危险',
    richness: '丰饶',
    hint: '提示',
    privateNote: '这是你的私密传送门，你的行为会实时影响共享世界',
    worldBroadcast: '世界广播',
    noLogYet: '世界刚刚苏醒，等待第一个脚印…',
    helpText: '支持自然语言：直接描述你想做什么；也支持传统指令：look / go north / talk / search / inventory',
    level: '等级',
    hp: '生命',
    globalEvent: '世界事件',
    justNow: '刚刚',
    minutesAgo: '分钟前',
  },
  'zh-TW': {
    worldTitle: '永恆沙漏',
    worldSubtitle: '一個由所有人共同書寫、永不落幕的世界',
    enterWorld: '踏入世界',
    yourRole: '你的身份',
    currentLocation: '當前位置',
    worldLog: '世界動態',
    onlineNow: '此刻在線',
    actionsCount: '次行動',
    playersEver: '位旅人曾來過',
    typePlaceholder: '輸入你想做的任何事… 如：觀察四周、往北走、和酒館老闆交談',
    send: '行動',
    look: '觀察',
    inventory: '背包',
    map: '地圖',
    district: '區域',
    danger: '危險',
    richness: '豐饒',
    hint: '提示',
    privateNote: '這是你的私密傳送門，你的行為會實時影響共享世界',
    worldBroadcast: '世界廣播',
    noLogYet: '世界剛剛甦醒，等待第一個腳印…',
    helpText: '支援自然語言：直接描述你想做什麼；也支援傳統指令：look / go north / talk / search / inventory',
    level: '等級',
    hp: '生命',
    globalEvent: '世界事件',
    justNow: '剛剛',
    minutesAgo: '分鐘前',
  },
  en: {
    worldTitle: 'The Eternal Hourglass',
    worldSubtitle: 'A never-ending world written together by all who enter',
    enterWorld: 'Enter the World',
    yourRole: 'Your role',
    currentLocation: 'Location',
    worldLog: 'World Feed',
    onlineNow: 'online now',
    actionsCount: 'actions',
    playersEver: 'travelers have passed',
    typePlaceholder: 'Describe anything you do… e.g. look around, go north, talk to the barkeep',
    send: 'Act',
    look: 'Look',
    inventory: 'Inventory',
    map: 'Map',
    district: 'District',
    danger: 'Danger',
    richness: 'Richness',
    hint: 'Hint',
    privateNote: 'This is your private portal — your actions shape the shared world in real time',
    worldBroadcast: 'World Broadcast',
    noLogYet: 'The world has just awoken, awaiting the first footprint…',
    helpText: 'Natural language works: just say what you do. Classic commands also work: look / go north / talk / search / inventory',
    level: 'Lv',
    hp: 'HP',
    globalEvent: 'World Event',
    justNow: 'just now',
    minutesAgo: 'min ago',
  },
  ja: {
    worldTitle: '永遠の砂時計',
    worldSubtitle: '訪れた全員で紡がれる、終わらない世界',
    enterWorld: '世界へ入る',
    yourRole: 'あなたの役割',
    currentLocation: '現在地',
    worldLog: 'ワールドフィード',
    onlineNow: 'オンライン',
    actionsCount: '回の行動',
    playersEver: '人が訪れた',
    typePlaceholder: '何をしたいか書いて… 例：周りを見る、北へ行く、酒場の主人に話しかける',
    send: '行動',
    look: '見る',
    inventory: '所持品',
    map: 'マップ',
    district: 'エリア',
    danger: '危険',
    richness: '豊かさ',
    hint: 'ヒント',
    privateNote: 'これはあなたのプライベートポータル — 行動は共有世界にリアルタイムで反映されます',
    worldBroadcast: '世界放送',
    noLogYet: '世界は目覚めたばかり、最初の足跡を待っています…',
    helpText: '自然な言葉でOK：やりたいことをそのまま書いて。古典コマンドも使える：look / go north / talk / search / inventory',
    level: 'Lv',
    hp: 'HP',
    globalEvent: 'ワールドイベント',
    justNow: 'たった今',
    minutesAgo: '分前',
  },
  fr: {
    worldTitle: 'Le Sablier Éternel',
    worldSubtitle: 'Un monde sans fin, écrit par tous ceux qui entrent',
    enterWorld: 'Entrer dans le monde',
    yourRole: 'Votre rôle',
    currentLocation: 'Lieu',
    worldLog: 'Flux mondial',
    onlineNow: 'en ligne',
    actionsCount: 'actions',
    playersEver: 'voyageurs sont passés',
    typePlaceholder: 'Décrivez ce que vous faites… ex. regarder autour, aller au nord, parler au tavernier',
    send: 'Agir',
    look: 'Regarder',
    inventory: 'Inventaire',
    map: 'Carte',
    district: 'Quartier',
    danger: 'Danger',
    richness: 'Richesse',
    hint: 'Astuce',
    privateNote: 'Ceci est votre portail privé — vos actions façonnent le monde partagé en temps réel',
    worldBroadcast: 'Annonce mondiale',
    noLogYet: 'Le monde vient de s’éveiller, attendant la première empreinte…',
    helpText: 'Langage naturel : dites ce que vous faites. Commandes classiques : look / go north / talk / search / inventory',
    level: 'Niv',
    hp: 'PV',
    globalEvent: 'Événement mondial',
    justNow: 'à l’instant',
    minutesAgo: 'min',
  },
  es: {
    worldTitle: 'El Reloj de Arena Eterno',
    worldSubtitle: 'Un mundo sin final, escrito por todos los que entran',
    enterWorld: 'Entrar al mundo',
    yourRole: 'Tu rol',
    currentLocation: 'Ubicación',
    worldLog: 'Feed del mundo',
    onlineNow: 'en línea',
    actionsCount: 'acciones',
    playersEver: 'viajeros han pasado',
    typePlaceholder: 'Describe lo que haces… ej. mirar alrededor, ir al norte, hablar con el tabernero',
    send: 'Actuar',
    look: 'Mirar',
    inventory: 'Inventario',
    map: 'Mapa',
    district: 'Distrito',
    danger: 'Peligro',
    richness: 'Riqueza',
    hint: 'Pista',
    privateNote: 'Este es tu portal privado — tus acciones moldean el mundo compartido en tiempo real',
    worldBroadcast: 'Anuncio mundial',
    noLogYet: 'El mundo acaba de despertar, esperando la primera huella…',
    helpText: 'Lenguaje natural: di lo que haces. Comandos clásicos: look / go north / talk / search / inventory',
    level: 'Nv',
    hp: 'PV',
    globalEvent: 'Evento mundial',
    justNow: 'ahora',
    minutesAgo: 'min',
  },
  de: {
    worldTitle: 'Die Ewige Sanduhr',
    worldSubtitle: 'Eine niemals endende Welt, geschrieben von allen, die eintreten',
    enterWorld: 'Welt betreten',
    yourRole: 'Deine Rolle',
    currentLocation: 'Ort',
    worldLog: 'Welt-Feed',
    onlineNow: 'online',
    actionsCount: 'Aktionen',
    playersEver: 'Reisende waren hier',
    typePlaceholder: 'Beschreibe was du tust… z.B. umsehen, nach Norden gehen, mit dem Wirt sprechen',
    send: 'Handeln',
    look: 'Umschauen',
    inventory: 'Inventar',
    map: 'Karte',
    district: 'Distrikt',
    danger: 'Gefahr',
    richness: 'Reichtum',
    hint: 'Hinweis',
    privateNote: 'Dies ist dein privates Portal — deine Taten formen die gemeinsame Welt in Echtzeit',
    worldBroadcast: 'Weltnachricht',
    noLogYet: 'Die Welt ist gerade erwacht und wartet auf den ersten Fußabdruck…',
    helpText: 'Natürliche Sprache: sag was du tust. Klassische Befehle: look / go north / talk / search / inventory',
    level: 'St',
    hp: 'LP',
    globalEvent: 'Weltereignis',
    justNow: 'gerade eben',
    minutesAgo: 'Min',
  },
  ko: {
    worldTitle: '영원한 모래시계',
    worldSubtitle: '모두가 함께 쓰는 끝나지 않는 세계',
    enterWorld: '세계 입장',
    yourRole: '당신의 역할',
    currentLocation: '현재 위치',
    worldLog: '세계 소식',
    onlineNow: '접속 중',
    actionsCount: '회 행동',
    playersEver: '명의 여행자가 다녀갔어요',
    typePlaceholder: '하고 싶은 걸 말해봐… 예: 주변을 둘러본다, 북쪽으로 간다, 선술집 주인과 대화',
    send: '행동',
    look: '둘러보기',
    inventory: '인벤토리',
    map: '지도',
    district: '구역',
    danger: '위험',
    richness: '풍요',
    hint: '힌트',
    privateNote: '이건 당신의 비밀 포탈 — 당신의 행동이 공유 세계를 실시간으로 바꿉니다',
    worldBroadcast: '세계 방송',
    noLogYet: '세계가 막 깨어났어요, 첫 발자국을 기다리는 중…',
    helpText: '자연어로 말하면 돼요: 하고 싶은 걸 그대로 쓰세요. 전통 명령어도 가능: look / go north / talk / search / inventory',
    level: 'Lv',
    hp: 'HP',
    globalEvent: '세계 이벤트',
    justNow: '방금',
    minutesAgo: '분 전',
  },
  it: {
    worldTitle: 'La Clessidra Eterna',
    worldSubtitle: 'Un mondo senza fine, scritto da chiunque vi entri',
    enterWorld: 'Entra nel mondo',
    yourRole: 'Il tuo ruolo',
    currentLocation: 'Posizione',
    worldLog: 'Feed mondiale',
    onlineNow: 'online',
    actionsCount: 'azioni',
    playersEver: 'viaggiatori sono passati',
    typePlaceholder: 'Descrivi cosa fai… es. guardati intorno, vai a nord, parla con l’oste',
    send: 'Agisci',
    look: 'Guarda',
    inventory: 'Inventario',
    map: 'Mappa',
    district: 'Distretto',
    danger: 'Pericolo',
    richness: 'Ricchezza',
    hint: 'Suggerimento',
    privateNote: 'Questo è il tuo portale privato — le tue azioni plasmano il mondo condiviso in tempo reale',
    worldBroadcast: 'Annuncio mondiale',
    noLogYet: 'Il mondo si è appena risvegliato, in attesa della prima impronta…',
    helpText: 'Linguaggio naturale: di’ cosa fai. Comandi classici: look / go north / talk / search / inventory',
    level: 'Lv',
    hp: 'PV',
    globalEvent: 'Evento mondiale',
    justNow: 'adesso',
    minutesAgo: 'min fa',
  },
  ar: {
    worldTitle: 'الساعة الرملية الأبدية',
    worldSubtitle: 'عالم لا ينتهي، يكتبه كل من يدخله',
    enterWorld: 'ادخل العالم',
    yourRole: 'دورك',
    currentLocation: 'الموقع',
    worldLog: 'سجل العالم',
    onlineNow: 'متصل الآن',
    actionsCount: 'إجراءات',
    playersEver: 'مسافرون مرّوا من هنا',
    typePlaceholder: 'صف ما تفعله… مثل: انظر حولك، اذهب شمالاً، تحدث مع صاحب الحانة',
    send: 'تحرّك',
    look: 'انظر',
    inventory: 'الحقيبة',
    map: 'الخريطة',
    district: 'المنطقة',
    danger: 'الخطر',
    richness: 'الثراء',
    hint: 'تلميح',
    privateNote: 'هذه بوابتك الخاصة — أفعالك تشكّل العالم المشترك في الوقت الفعلي',
    worldBroadcast: 'بث عالمي',
    noLogYet: 'العالم استيقظ للتو، بانتظار أول أثر…',
    helpText: 'اللغة الطبيعية: صف ما تفعله. الأوامر الكلاسيكية: look / go north / talk / search / inventory',
    level: 'مستوى',
    hp: 'صحة',
    globalEvent: 'حدث عالمي',
    justNow: 'الآن',
    minutesAgo: 'دقائق',
  },
}

export function tWorld(lang: string, key: string): string {
  const dict = WORLD_MUD_I18N[lang] ?? WORLD_MUD_I18N.en
  return dict[key] ?? WORLD_MUD_I18N.en[key] ?? key
}
