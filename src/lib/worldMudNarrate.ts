/**
 * World MUD narration — Baseten LLM + deterministic fallback.
 * Supports both freeform natural language and button actions.
 */
import { getSupabaseClient } from './supabaseClient'
import { isSupabaseConfigured } from './supabaseConfig'
import type { WorldMudState, WorldMudScene, WorldLogEntry } from '../games/mud/worldTypes'
import { findRoom, findDistrict } from '../games/mud/worldTypes'
import { getLang } from './i18n'
import { roomNameOf, districtNameOf, getDistrictDesc } from './worldI18n'
import type { Lang } from './i18n'

export interface NarrateRequest {
  actionText: string
  locationId: string
  player: { displayName: string; role: string }
  lang: string // UI language — controls button labels (choices)
  narrativeLang?: string // input language — controls narrative; defaults to lang
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
  const narrativeLang = req.narrativeLang ?? req.lang
  const isZh = narrativeLang.startsWith('zh')
  const action = normalizeCommand(req.actionText)
  const room = findRoom(world, req.locationId)
  const district = room ? findDistrict(world, room.districtId) : null
  const actLower = action.toLowerCase()

  if (actLower.startsWith('go ')) {
    const dir = actLower.slice(3).trim()
    const targetId = room?.exits[dir]
    if (targetId) {
      const target = findRoom(world, targetId)
      const targetRoomName = target ? roomNameOf(target.id, narrativeLang as Lang) : (isZh ? '未知之地' : 'unknown')
      const targetDesc = target ? getDistrictDesc(findDistrict(world, target.districtId)!, narrativeLang as Lang) : ''
      const goMap: Record<string, string> = {
        zh: `你沿着${dir === 'north' ? '北' : dir === 'south' ? '南' : dir === 'east' ? '东' : '西'}方前行，来到${targetRoomName}。${targetDesc} 空气中弥漫着新的气息。`,
        'zh-TW': `你沿著${dir === 'north' ? '北' : dir === 'south' ? '南' : dir === 'east' ? '東' : '西'}方前行，來到${targetRoomName}。${targetDesc}`,
        ja: `${dir}へ進み、${targetRoomName}に到着した。${targetDesc} 冷たい空気が肌を撫で、石壁の埃の匂いと遠くの足音が漂う。`,
        en: `You head ${dir} and arrive at ${targetRoomName}. ${targetDesc} The air feels different here.`,
        fr: `Vous allez vers ${dir} et arrivez à ${targetRoomName}. ${targetDesc}`,
        es: `Avanzas hacia ${dir} y llegas a ${targetRoomName}. ${targetDesc}`,
        de: `Du gehst nach ${dir} und erreichst ${targetRoomName}. ${targetDesc}`,
        ko: `${dir}쪽으로 이동해 ${targetRoomName}에 도착했다. ${targetDesc}`,
        it: `Vai verso ${dir} e arrivi a ${targetRoomName}. ${targetDesc}`,
        ar: `تتجه ${dir} وتصل إلى ${targetRoomName}. ${targetDesc}`,
      }
      return {
        narrative: goMap[narrativeLang] ?? goMap[isZh ? 'zh' : 'en'],
        choices: fallbackChoices(req.lang, targetId, world),
        hint: `Moved to ${targetRoomName}`,
        broadcast: `traveled to ${targetRoomName}`,
      }
    }
    const blocked: Record<string, string> = { zh: '此路不通。试试其他方向，或使用“观察”了解出口。', 'zh-TW': '此路不通。試試其他方向。', ja: 'その方向には進めない。別の方向を試して。', fr: 'Vous ne pouvez pas aller par là.', es: 'No puedes ir por ahí.', de: 'Du kannst nicht dorthin gehen.', ko: '그쪽으로는 갈 수 없다.', it: 'Non puoi andare da quella parte.', ar: 'لا يمكنك الذهاب من هناك.', en: `You can't go that way. Try another direction or "look" to see exits.` }
    return {
      narrative: blocked[narrativeLang] ?? blocked.en,
      choices: fallbackChoices(req.lang, req.locationId, world),
      broadcast: isZh ? '尝试移动但碰壁了' : 'tried to move but hit a wall',
    }
  }

  if (actLower === 'look' || actLower === 'l') {
    const exits = room ? Object.entries(room.exits).map(([d]) => d).join(', ') : '—'
    const dDesc = district ? getDistrictDesc(district, narrativeLang as Lang) : ''
    const dName = district ? districtNameOf(district.id, narrativeLang as Lang) : ''
    const rName = room ? roomNameOf(room.id, narrativeLang as Lang) : (isZh ? '未知之地' : 'Unknown')
    const tenseMap: Record<string, string> = {
      zh: '空气中有一丝紧张感。', 'zh-TW': '空氣中有一絲緊張感。', ja: '空気に緊張感が漂う。', fr: 'Une tension flotte dans l’air.',
      es: 'Hay tensión en el aire.', de: 'Spannung liegt in der Luft.', ko: '공기에 긴장감이 감돈다.', it: 'Tensione nell’aria.', ar: 'توتر في الهواء.', en: 'There is a faint tension in the air.',
    }
    const calmMap: Record<string, string> = {
      zh: '这里相对平静。', 'zh-TW': '這裡相對平靜。', ja: 'ここは比較的穏やかだ。', fr: 'Ici, c’est relativement calme.', es: 'Aquí está relativamente tranquilo.',
      de: 'Hier ist es relativ ruhig.', ko: '여기는 비교적 평온하다.', it: 'Qui è relativamente calmo.', ar: 'المكان هادئ نسبياً.', en: 'It feels relatively calm.',
    }
    const danger = room?.danger ? (tenseMap[narrativeLang] ?? tenseMap.en) : (calmMap[narrativeLang] ?? calmMap.en)
    return {
      narrative: `${dName}·${rName}。${dDesc} ${danger} 出口：${exits || '—'}。`,
      choices: fallbackChoices(req.lang, req.locationId, world),
      broadcast: narrativeLang.startsWith('zh') ? '环顾四周' : narrativeLang === 'ja' ? '周囲を見た' : 'looked around',
    }
  }

  const rn = (l: Lang) => room ? roomNameOf(room.id, l) : (l.startsWith('zh') ? '这里' : l === 'ja' ? 'ここ' : l === 'ar' ? 'هنا' : 'here')
  const dn = (l: Lang) => district ? districtNameOf(district.id, l) : (l.startsWith('zh') ? '这片街区' : 'this district')
  const TALK: Record<string, { narrative: string; broadcast: string }> = {
    zh: { narrative: `你在${rn('zh')}与人攀谈。炉火噼啪，酒杯轻碰，陌生人递来眼神——关于${dn('zh')}的传闻在空气中流转，带着陈旧纸张与香料的气味。微风拂过，你感到自己正在融入这个世界，沙漏的光在远处轻轻指引着下一步。`, broadcast: '与人交谈' },
    'zh-TW': { narrative: `你在${rn('zh-TW')}與人攀談。爐火劈啪，陌生人遞來眼神——關於${dn('zh-TW')}的傳聞流轉。微風中，你融入世界，新線索在前。`, broadcast: '與人交談' },
    ja: { narrative: `あなたは${rn('ja')}で誰かに話しかけた。暖炉の火がパチパチと弾け、埃と古い紙の匂いと共に見知らぬ者が${dn('ja')}にまつわる噂を囁く。冷たい石壁が微かに共鳴し、あなたは次第に世界に溶け込み、新たな手がかりが仄かに浮かぶ。`, broadcast: '誰かと話した' },
    fr: { narrative: `Vous parlez à ${rn('fr')}. Le feu crépite, un inconnu confie une rumeur sur ${dn('fr')}, mêlée d’odeur de vieux papier. L’air frémit, vous vous sentez chez vous, la lueur du sablier montre la suite.`, broadcast: 'a parlé' },
    es: { narrative: `Hablas en ${rn('es')}. El fuego crepita, un desconocido susurra sobre ${dn('es')} con olor a papel viejo. Vibras, te sientes parte, el reloj guía tu próximo paso.`, broadcast: 'habló' },
    de: { narrative: `Du sprichst in ${rn('de')}. Feuer knistert, ein Fremder flüstert über ${dn('de')} mit Geruch nach altem Papier. Luft bebt, du bist angekommen, Sanduhr leuchtet den Weg.`, broadcast: 'sprach' },
    ko: { narrative: `${rn('ko')}에서 대화했다. 난로 불꽃과 먼지 냄새 속 낯선 이가 ${dn('ko')} 소문을 속삭인다. 공기가 떨리고, 당신은 세계에 스며들어 새 단서가 떠오른다.`, broadcast: '대화' },
    it: { narrative: `Parli a ${rn('it')}. Fuoco scoppietta, uno sconosciuto sussurra su ${dn('it')} con odore di carta vecchia. Aria vibra, ti senti a casa, luce indica.`, broadcast: 'parlato' },
    ar: { narrative: `تتحدث في ${rn('ar')}. النار تفرقع، غريب يهمس عن ${dn('ar')} برائحة ورق قديم. يهتز الهواء وتشعر بانتماء، ضوء الساعة يرشدك.`, broadcast: 'تحدث' },
    en: { narrative: `You talk at ${rn('en')}. Fire crackles, a stranger whispers of ${dn('en')} with scent of old paper. Air shivers, you feel at home, light guides your next step.`, broadcast: 'talked' },
  }
  if (actLower === 'talk') {
    const t = TALK[narrativeLang] ?? TALK[uiLang(narrativeLang)] ?? TALK.en
    return { narrative: t.narrative, choices: fallbackChoices(req.lang, req.locationId, world), broadcast: t.broadcast }
  }
  const SEARCH: Record<string, { narrative: string; broadcast: string }> = {
    zh: { narrative: `你在${rn('zh')}仔细搜索，指尖划过石缝旧木，发现发光碎片，沙光流转似指引。前方传来轻响，更多秘密在幽处等待。`, broadcast: '搜索' },
    'zh-TW': { narrative: `你在${rn('zh-TW')}仔細搜索，石縫間發現發光碎片，沙光流轉指引。前方輕響，秘密待掘。`, broadcast: '搜索' },
    ja: { narrative: `${rn('ja')}を隅々まで探し、石の隙間から光る欠片を見つけた。砂時計の光が脉打ち、埃の匂いと奥からの微かな物音が次の手がかりを手招きする。`, broadcast: '捜索' },
    fr: { narrative: `Vous fouillez ${rn('fr')}. Éclat luisant, lueur du sablier ondule. Un bruit ténu promet d’autres secrets.`, broadcast: 'fouillé' },
    es: { narrative: `Registras ${rn('es')} con cuidado. Fragmento brillante, luz del reloj nada. Un leve rumor promete secretos.`, broadcast: 'buscó' },
    de: { narrative: `Du suchst in ${rn('de')} gründlich. Leuchtender Splitter, Sanduhrlicht fließt. Fernes Geräusch verheißt Geheimnisse.`, broadcast: 'gesucht' },
    ko: { narrative: `${rn('ko')}를 꼼꼼히 수색해 빛나는 파편을 찾았다. 모래시계 빛이 흐르고, 저편에서 가벼운 소리가 더 많은 비밀을 알린다.`, broadcast: '수색' },
    it: { narrative: `Perquisisci ${rn('it')} con cura. Frammento lucente, luce scorre. Un fruscio lontano promette segreti.`, broadcast: 'cercato' },
    ar: { narrative: `تفتش ${rn('ar')} بعناية. شظية لامعة، ضوء يسري كرسالة. همس خافت يعد بالمزيد.`, broadcast: 'فتش' },
    en: { narrative: `You search ${rn('en')} carefully. A glinting shard appears, hourglass light swims. A faint sound promises more.`, broadcast: 'searched' },
  }
  if (actLower === 'search') {
    const t = SEARCH[narrativeLang] ?? SEARCH.en
    return { narrative: t.narrative, choices: fallbackChoices(req.lang, req.locationId, world), broadcast: t.broadcast }
  }
  function uiLang(l: string): string { return l.startsWith('zh') ? 'zh' : l }
  if (actLower === 'inventory' || actLower === 'inv' || actLower === '背包') {
    const inv: Record<string, string> = {
      zh: `你打开背包：里面只有一小时旅人标配——一枚沙漏、一张发黄的便条，写着“别忘了，你是来写故事的”。指尖触到沙粒的温热，前方的路似乎也在呼应。`,
      'zh-TW': `你打開背包：裡面只有一小時旅人標配——一枚沙漏、一張發黃的便條，寫著「別忘了，你是來寫故事的」。`,
      ja: `荷物を改めると、一時間の旅人の装備だけが入っている——砂時計と黄ばんだメモ、「君は物語を書きに来たことを忘れるな」と書かれている。砂の温もりが指先に伝わり、前途が呼応するように感じた。`,
      fr: `Vous ouvrez votre sac : un sablier et un mot jauni — « n’oublie pas, tu es venu écrire une histoire ». Le sable tiède frémit sous vos doigts, comme si le chemin devant vous répondait.`,
      es: `Abres tu mochila: un reloj de arena y una nota amarillenta — «recuerda, viniste a escribir una historia». La arena tibia vibra bajo tus dedos, como si el camino respondiera.`,
      de: `Du öffnest dein Gepäck: eine Sanduhr und ein vergilbter Zettel — „Vergiss nicht, du bist gekommen, um eine Geschichte zu schreiben.“ Warmer Sand vibriert unter deinen Fingern.`,
      ko: `가방을 열자 한 시간 여행자의 기본 장비만 들어 있다 — 모래시계와 누렇게 바랜 쪽지, “넌 이야기를 쓰러 왔다는 걸 잊지 마”라고 적혀 있다. 따뜻한 모래가 손끝에서 떨린다.`,
      it: `Apri lo zaino: una clessidra e un biglietto ingiallito — “ricorda, sei venuto a scrivere una storia”. La sabbia tiepida vibra sotto le dita.`,
      ar: `تفتح حقيبتك: ساعة رملية وورقة مصفرة — “تذكر، جئت لتكتب قصة”. الرمل الدافئ يهتز تحت أصابعك.`,
      en: `You check your pack: an hourglass and a yellowed note — “remember, you’re here to write a story.” Warm sand hums under your fingers, as if the road ahead is listening.`,
    }
    return { narrative: inv[narrativeLang] ?? inv.en, choices: fallbackChoices(req.lang, req.locationId, world), broadcast: narrativeLang.startsWith('zh') ? '查看了背包' : 'checked inventory' }
  }
  if (actLower === 'help') {
    const help: Record<string, string> = {
      zh: `提示：你可以直接用自然语言描述想做的事（如“和酒馆老板聊聊”），或用传统指令 look / go north / talk / search。点地图可快速跳转相邻区域。远方的沙漏轻响，提醒你时间有限——大胆去探索吧。`,
      'zh-TW': `提示：你可以直接用自然語言描述想做的事，或用傳統指令。點地圖可快速跳轉。`,
      ja: `ヒント：やりたいことを自然な言葉で書いてください。伝統的なコマンド（look / go north / talk / search）も使えます。地図をタップすると近くの部屋へ素早く移動できます。砂時計の音が時間を告げています。`,
      fr: `Astuce : décrivez simplement ce que vous voulez faire en langage naturel, ou utilisez les commandes classiques. Touchez la carte pour sauter vers une salle voisine.`,
      es: `Consejo: describe lo que quieres hacer en lenguaje natural o usa comandos clásicos. Toca el mapa para saltar a salas cercanas.`,
      de: `Tipp: Beschreibe einfach in natürlicher Sprache, was du tun willst, oder nutze klassische Befehle. Tippe auf die Karte, um zu springen.`,
      ko: `팁: 자연어로 하고 싶은ことを 말하거나 전통 명령어를 사용하세요. 지도를 탭하면 nearby 방으로 이동합니다.`,
      it: `Suggerimento: descrivi in linguaggio naturale cosa vuoi fare o usa i comandi classici. Tocca la mappa per saltare.`,
      ar: `تلميح: صف ما تريد فعله بلغة طبيعية أو استخدم الأوامر التقليدية. انقر على الخريطة للانتقال.`,
      en: `Tip: just describe what you want to do in natural language, or use classic commands: look / go north / talk / search. Tap the map to jump to nearby rooms. The hourglass ticks — make it count.`,
    }
    return { narrative: help[narrativeLang] ?? help.en, choices: fallbackChoices(req.lang, req.locationId, world), broadcast: narrativeLang.startsWith('zh') ? '请求了帮助' : 'asked for help' }
  }

  const dName2 = district ? districtNameOf(district.id, narrativeLang as Lang) : ''
  const rName2 = room ? roomNameOf(room.id, narrativeLang as Lang) : ''
  if (narrativeLang.startsWith('zh')) {
    return {
      narrative: `你说道：“${req.actionText}” —— 世界仿佛听见了。${room ? `在${dName2}·${rName2}，你的行动引起了微妙的变化，空气中泛起细微涟漪。` : ''} 前方似乎有新的可能在等待，沙漏的光指引着下一步。`,
      choices: fallbackChoices(req.lang, req.locationId, world),
      broadcast: req.actionText.slice(0, 40),
    }
  }
  if (narrativeLang === 'ja') return { narrative: `あなたは「${req.actionText}」と口にした。${room ? `${rName2}の冷たい空気が微かに震え、石壁の埃の匂いと共にあなたの行動が波紋を広げる。` : ''} 新たな可能性が前方で手招きし、砂時計の光が次の一歩を仄かに照らす。`, choices: fallbackChoices(req.lang, req.locationId, world), broadcast: req.actionText.slice(0, 40) }
  if (narrativeLang === 'fr') return { narrative: `Vous dites « ${req.actionText} » — le monde semble écouter. ${room ? `À ${rName2}, votre geste fait frémir l’air, une ondulation parcourt ${dName2}.` : ''} De nouvelles possibilités s’ouvrent, la lueur du sablier montre la suite.`, choices: fallbackChoices(req.lang, req.locationId, world), broadcast: req.actionText.slice(0, 40) }
  if (narrativeLang === 'ko') return { narrative: `당신은 “${req.actionText}”라고 말했다. ${room ? `${rName2}의 공기가 미세하게 떨리며 당신의 행동이 파문을 일으킨다.` : ''} 새로운 가능성이 앞에서 손짓하고 모래시계 빛이 다음 걸음을 비춘다.`, choices: fallbackChoices(req.lang, req.locationId, world), broadcast: req.actionText.slice(0, 40) }
  if (narrativeLang === 'ar') return { narrative: `تقول “${req.actionText}” — يبدو أن العالم ينصت. ${room ? `في ${rName2}، يهتز الهواء مع فعلك.` : ''} إمكانيات جديدة تلوح، وضوء الساعة يرشدك.`, choices: fallbackChoices(req.lang, req.locationId, world), broadcast: req.actionText.slice(0, 40) }
  return {
    narrative: `You say: "${req.actionText}" — the world seems to listen. ${room ? `At ${dName2} — ${rName2}, your action stirs subtle changes, ripples spreading through the air.` : ''} New possibilities await ahead, the hourglass light guiding your next step.`,
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
    const narrativeLang = req.narrativeLang ?? req.lang
    const { data, error } = await client.functions.invoke('world-mud-narrate', {
      body: {
        actionText: action,
        locationId: req.locationId,
        districtId: district?.id ?? 'plaza',
        roomName: room?.nameEn ?? room?.name ?? req.locationId,
        player: req.player,
        lang: req.lang, // UI lang for choices
        narrativeLang,
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
