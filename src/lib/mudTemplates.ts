import type { PresenceMember } from './chatTypes'

export type MudTheme = 'ruin' | 'lab' | 'forest' | 'city' | 'ocean' | 'tavern' | 'academy'
export interface MudRoom { id: string; name: string; nameEn: string; prompt: string }
export interface MudBlueprint {
  title: string
  titleEn: string
  theme: MudTheme
  partyRoles: string[]
  rooms: MudRoom[]
}

const ROLE_THEME_MAP: Array<{ re: RegExp; theme: MudTheme }> = [
  { re: /工程师|程序|开发|engineer|developer|programmer/i, theme: 'lab' },
  { re: /科学|研究|博士|scientist|research/i, theme: 'lab' },
  { re: /学生|老师|教授|教师|student|teacher|prof/i, theme: 'academy' },
  { re: /骑士|武士|剑士|战士|warrior|knight|samurai/i, theme: 'ruin' },
  { re: /法师|巫师|魔法|mage|wizard/i, theme: 'ruin' },
  { re: /探险|冒险|adventur/i, theme: 'forest' },
  { re: /船长|水手|海|sailor|pirate|ocean/i, theme: 'ocean' },
  { re: /酒|厨|酿|chef|bartender/i, theme: 'tavern' },
  { re: /侦探|警察|记者|detective|police/i, theme: 'city' },
]

function pickTheme(roles: string[]): MudTheme {
  const votes = new Map<MudTheme, number>()
  for (const role of roles) {
    for (const { re, theme } of ROLE_THEME_MAP) {
      if (re.test(role)) {
        votes.set(theme, (votes.get(theme) ?? 0) + 1)
        break
      }
    }
  }
  let best: MudTheme | null = null
  let bestScore = 0
  for (const [t, s] of votes) if (s > bestScore) { best = t; bestScore = s }
  if (best) return best
  const fallback: MudTheme[] = ['ruin', 'forest', 'city', 'tavern', 'ocean', 'lab']
  return fallback[Math.floor(Math.random() * fallback.length)]
}

const WORLD_SKELETONS: Record<MudTheme, { title: string; titleEn: string; rooms: MudRoom[] }> = {
  ruin: {
    title: '失落遗迹', titleEn: 'Lost Ruin',
    rooms: [
      { id: 'gate', name: '遗迹大门', nameEn: 'Ancient Gate', prompt: 'moss-covered stone gate' },
      { id: 'hall', name: '回声大厅', nameEn: 'Echo Hall', prompt: 'vast hall with crumbling pillars' },
      { id: 'library', name: '尘封书库', nameEn: 'Dusty Archive', prompt: 'collapsed library with glowing runes' },
      { id: 'pit', name: '深渊裂隙', nameEn: 'Abyss Rift', prompt: 'narrow chasm with ancient bridge' },
      { id: 'throne', name: '王座之间', nameEn: 'Throne Room', prompt: 'throne room with final guardian' },
    ],
  },
  lab: {
    title: '废弃实验室', titleEn: 'Abandoned Lab',
    rooms: [
      { id: 'lobby', name: '接待大厅', nameEn: 'Lobby', prompt: 'abandoned lab lobby flickering lights' },
      { id: 'lab1', name: '实验区 A', nameEn: 'Lab A', prompt: 'shattered lab with strange specimens' },
      { id: 'server', name: '主机房', nameEn: 'Server Room', prompt: 'server room with humming cores' },
      { id: 'greenhouse', name: '生态温室', nameEn: 'Greenhouse', prompt: 'overgrown greenhouse inside lab' },
      { id: 'core', name: '核心反应炉', nameEn: 'Reactor Core', prompt: 'reactor core final chamber' },
    ],
  },
  forest: {
    title: '迷雾森林', titleEn: 'Misty Forest',
    rooms: [
      { id: 'trail', name: '林间小径', nameEn: 'Forest Trail', prompt: 'misty forest trail' },
      { id: 'lake', name: '月光湖', nameEn: 'Moon Lake', prompt: 'moonlit lake in forest' },
      { id: 'cabin', name: '猎人小屋', nameEn: 'Hunter Cabin', prompt: 'old cabin in woods' },
      { id: 'shrine', name: '古老神祠', nameEn: 'Old Shrine', prompt: 'forest shrine with stone statues' },
      { id: 'heart', name: '森林之心', nameEn: 'Heart of Forest', prompt: 'glowing heart of the forest' },
    ],
  },
  city: {
    title: '霓虹街区', titleEn: 'Neon District',
    rooms: [
      { id: 'alley', name: '雨巷', nameEn: 'Rain Alley', prompt: 'rainy neon alley' },
      { id: 'market', name: '夜市', nameEn: 'Night Market', prompt: 'crowded night market' },
      { id: 'rooftop', name: '天台', nameEn: 'Rooftop', prompt: 'rooftop overlooking city' },
      { id: 'club', name: '地下俱乐部', nameEn: 'Underground Club', prompt: 'underground club with secrets' },
      { id: 'vault', name: '金库', nameEn: 'Vault', prompt: 'hidden vault final room' },
    ],
  },
  ocean: {
    title: '深海遗迹', titleEn: 'DeepSea Ruin',
    rooms: [
      { id: 'shore', name: '礁海岸', nameEn: 'Reef Shore', prompt: 'rocky shore with wreckage' },
      { id: 'cave', name: '潮汐洞窟', nameEn: 'Tide Cave', prompt: 'sea cave with bioluminescence' },
      { id: 'wreck', name: '沉船', nameEn: 'Wreck', prompt: 'sunken ship interior' },
      { id: 'trench', name: '海沟', nameEn: 'Trench', prompt: 'deep trench with ancient gate' },
      { id: 'palace', name: '海底宫殿', nameEn: 'Sea Palace', prompt: 'underwater palace throne' },
    ],
  },
  tavern: {
    title: '奇遇酒馆', titleEn: 'Wondrous Tavern',
    rooms: [
      { id: 'door', name: '酒馆门前', nameEn: 'Tavern Door', prompt: 'cozy tavern entrance at dusk' },
      { id: 'hall', name: '喧闹大厅', nameEn: 'Tavern Hall', prompt: 'lively tavern hall' },
      { id: 'cellar', name: '酒窖', nameEn: 'Cellar', prompt: 'cellar with hidden passage' },
      { id: 'attic', name: '阁楼密室', nameEn: 'Attic Secret', prompt: 'attic with treasure map' },
      { id: 'roof', name: '屋顶星空', nameEn: 'Rooftop Stars', prompt: 'tavern rooftop under stars' },
    ],
  },
  academy: {
    title: '星辰学院', titleEn: 'Star Academy',
    rooms: [
      { id: 'gate', name: '学院正门', nameEn: 'Academy Gate', prompt: 'grand academy gate' },
      { id: 'library', name: '星图图书馆', nameEn: 'Star Library', prompt: 'library with floating books' },
      { id: 'tower', name: '观星塔', nameEn: 'Observatory', prompt: 'observatory tower' },
      { id: 'lab', name: '炼金工坊', nameEn: 'Alchemy Lab', prompt: 'alchemy workshop' },
      { id: 'vault', name: '禁书库', nameEn: 'Forbidden Vault', prompt: 'forbidden vault final' },
    ],
  },
}

export function buildMudBlueprint(party: PresenceMember[]): MudBlueprint {
  const partyRoles = party.map((m) => m.role ?? '').filter(Boolean)
  const theme = pickTheme(partyRoles)
  const skeleton = WORLD_SKELETONS[theme]
  return { title: skeleton.title, titleEn: skeleton.titleEn, theme, partyRoles, rooms: skeleton.rooms }
}

export interface MudScene { text: string; choices: Array<{ label: string; action: string }> }

const CHOICE_POOL: Array<{ label: string; labelEn: string; action: string }> = [
  { label: '探索四周', labelEn: 'Explore', action: 'explore' },
  { label: '与之交谈', labelEn: 'Talk', action: 'talk' },
  { label: '小心潜行', labelEn: 'Sneak', action: 'sneak' },
  { label: '勇敢出击', labelEn: 'Strike', action: 'strike' },
  { label: '调查线索', labelEn: 'Investigate', action: 'investigate' },
  { label: '使用道具', labelEn: 'Use Item', action: 'use' },
]

export function buildInviteText(party: PresenceMember[], companionName: string, isZh: boolean): string {
  const mentions = party.map((m) => `@${m.displayName}`).join(' ')
  const themeLabel = buildMudBlueprint(party)
  if (isZh) return `${mentions} 欢迎你们～ ✨ ${companionName} 为你们开启了一场 MUD 文字冒险《${themeLabel.title}》！点击下方卡片一起探索吧，每个人都可以投票选择下一步。`
  return `${mentions} Welcome adventurers ✨ ${companionName} has opened a MUD adventure "${themeLabel.titleEn}" for you! Tap the card below to explore together — everyone votes for the next move.`
}

export function buildOpeningScene(blueprint: MudBlueprint, party: PresenceMember[], lang: string): MudScene {
  const isZh = lang.startsWith('zh')
  const names = party.map((p) => p.displayName).join('、')
  const room = blueprint.rooms[0]
  const text = isZh
    ? `欢迎来到《${blueprint.title}》！冒险者 ${names} 聚集在${room.name}前。微光闪烁，前方传来神秘声响，你们的旅程即将开始。`
    : `Welcome to "${blueprint.titleEn}"! Adventurers ${names} gather at ${room.nameEn}. A faint glow flickers ahead — your journey begins.`
  const picks = pickChoices(3, isZh)
  return { text, choices: picks }
}

function pickChoices(n: number, isZh: boolean): Array<{ label: string; action: string }> {
  const shuffled = [...CHOICE_POOL].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n).map((c) => ({ label: isZh ? c.label : c.labelEn, action: c.action }))
}

export function fallbackNextScene(blueprint: MudBlueprint, step: number, lang: string): MudScene {
  const isZh = lang.startsWith('zh')
  const room = blueprint.rooms[Math.min(step, blueprint.rooms.length - 1)]
  const text = isZh
    ? `你们来到${room.name}。${room.prompt}。空气中弥漫着未知，做出你们的选择。`
    : `You arrive at ${room.nameEn}. ${room.prompt}. The air is tense — choose your next move.`
  return { text, choices: pickChoices(3, isZh) }
}
