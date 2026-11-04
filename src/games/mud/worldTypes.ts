/**
 * World MUD — the eternal shared realm.
 * One world, infinite stories. Each player joins for 1 hour with their role.
 */

// 7 districts + central nexus
export type DistrictId =
  | 'plaza'
  | 'ruin'
  | 'lab'
  | 'forest'
  | 'ocean'
  | 'city'
  | 'tavern'
  | 'academy'

export interface WorldDistrict {
  id: DistrictId
  name: string
  nameEn: string
  icon: string
  description: string
  descriptionEn: string
  color: string
  rooms: WorldRoom[]
}

export interface WorldRoom {
  id: string
  name: string
  nameEn: string
  districtId: DistrictId
  exits: Record<string, string> // direction -> roomId
  danger: number // 0-3
  richness: number // 0-3
}

export interface WorldNpc {
  id: string
  name: string
  nameEn: string
  role: string
  districtId: DistrictId
  roomId: string
  mood: 'friendly' | 'neutral' | 'hostile' | 'mysterious'
  memory: string[] // last interactions
}

export interface WorldItem {
  id: string
  name: string
  nameEn: string
  icon: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

export interface WorldPlayerView {
  userId: string
  displayName: string
  role: string
  avatarStyle: string | null
  avatarSeed: string | null
  avatarUrl: string | null
  locationId: string
  joinedAt: number
  level: number
  hp: number
  maxHp: number
  inventory: WorldItem[]
}

export interface WorldLogEntry {
  id: string
  at: number
  userId: string
  displayName: string
  role: string
  locationId: string
  action: string
  result: string // short LLM narrative fragment
  lang: string
  isSystem?: boolean
}

export interface WorldEvent {
  id: string
  title: string
  titleEn: string
  description: string
  descriptionEn: string
  icon: string
  endsAt: number | null
}

export interface WorldStats {
  totalActions: number
  totalPlayersEver: number
  totalRoomsDiscovered: number
  dayCount: number
}

export interface WorldMudState {
  worldId: string
  version: number
  createdAt: number
  updatedAt: number
  loreTitle: string
  loreTitleEn: string
  lore: string
  loreEn: string
  districts: WorldDistrict[]
  npcs: WorldNpc[]
  globalEvent: WorldEvent | null
  players: WorldPlayerView[]
  log: WorldLogEntry[]
  stats: WorldStats
  // Player-agnostic; per-client view derives from this + local player
  motd: string
  motdEn: string
}

export interface WorldMudChoice {
  label: string
  action: string
  icon?: string
}

export interface WorldMudScene {
  locationId: string
  locationName: string
  locationNameEn: string
  districtId: DistrictId
  narrative: string
  choices: WorldMudChoice[]
  hint?: string
  discovered?: boolean
}

export interface WorldMudActionResult {
  narrative: string
  scene: WorldMudScene
  worldLogEntry: WorldLogEntry
  playerUpdates?: Partial<WorldPlayerView>
  inventoryChange?: { added?: WorldItem[]; removed?: string[] }
  xpGain?: number
  broadcast?: string // for world feed
}

export const WORLD_ID = 'main'
export const WORLD_TTL_MS = 365 * 24 * 60 * 60 * 1000 // effectively eternal

// --- Static world map (LLM expands lore dynamically, but map stays navigable)

type RawDistrict = Omit<WorldDistrict, 'rooms'> & { rooms: Omit<WorldRoom, 'districtId'>[] }
export const WORLD_DISTRICTS_TEMPLATE: RawDistrict[] = [
  {
    id: 'plaza',
    name: '沙漏广场',
    nameEn: 'Hourglass Plaza',
    icon: '⏳',
    description: '时间的十字路口，所有灵魂在此降临与告别',
    descriptionEn: 'The crossroads of time, where every soul arrives and departs',
    color: '#c9a86a',
    rooms: [
      { id: 'plaza_center', name: '沙漏核心', nameEn: 'Hourglass Core', exits: { north: 'plaza_north', south: 'plaza_south', east: 'plaza_east', west: 'plaza_west' }, danger: 0, richness: 2 },
      { id: 'plaza_north', name: '星辰大道', nameEn: 'Starlight Avenue', exits: { south: 'plaza_center', north: 'academy_gate' }, danger: 0, richness: 1 },
      { id: 'plaza_south', name: '暮色码头', nameEn: 'Dusk Wharf', exits: { north: 'plaza_center', south: 'ocean_shore' }, danger: 0, richness: 1 },
      { id: 'plaza_east', name: '霓虹入口', nameEn: 'Neon Gate', exits: { west: 'plaza_center', east: 'city_alley' }, danger: 0, richness: 1 },
      { id: 'plaza_west', name: '古道岔口', nameEn: 'Old Trail Fork', exits: { east: 'plaza_center', west: 'forest_trail' }, danger: 0, richness: 1 },
    ],
  },
  {
    id: 'ruin',
    name: '低语遗迹',
    nameEn: 'Whispering Ruins',
    icon: '🏛️',
    description: '被遗忘王朝的回声，埋藏着时间的秘密',
    descriptionEn: 'Echoes of a forgotten dynasty, secrets buried in time',
    color: '#8b7355',
    rooms: [
      { id: 'ruin_gate', name: '遗迹大门', nameEn: 'Ruins Gate', exits: { south: 'plaza_west', north: 'ruin_hall' }, danger: 1, richness: 2 },
      { id: 'ruin_hall', name: '回声大厅', nameEn: 'Echo Hall', exits: { south: 'ruin_gate', north: 'ruin_library', east: 'ruin_pit' }, danger: 1, richness: 2 },
      { id: 'ruin_library', name: '尘封书库', nameEn: 'Dusty Archive', exits: { south: 'ruin_hall', north: 'ruin_throne' }, danger: 2, richness: 3 },
      { id: 'ruin_pit', name: '深渊裂隙', nameEn: 'Abyss Rift', exits: { west: 'ruin_hall' }, danger: 3, richness: 2 },
      { id: 'ruin_throne', name: '王座之间', nameEn: 'Throne Room', exits: { south: 'ruin_library' }, danger: 2, richness: 3 },
    ],
  },
  {
    id: 'lab',
    name: '霓光实验室',
    nameEn: 'Neon Laboratory',
    icon: '🧪',
    description: '废弃的时空实验场，机器仍在低鸣',
    descriptionEn: 'An abandoned spacetime lab, machines still humming low',
    color: '#5bb8d4',
    rooms: [
      { id: 'lab_lobby', name: '大厅', nameEn: 'Lobby', exits: { south: 'city_alley', north: 'lab_a' }, danger: 1, richness: 1 },
      { id: 'lab_a', name: '实验区A', nameEn: 'Lab A', exits: { south: 'lab_lobby', north: 'lab_core', east: 'lab_greenhouse' }, danger: 2, richness: 2 },
      { id: 'lab_greenhouse', name: '生态温室', nameEn: 'Greenhouse', exits: { west: 'lab_a' }, danger: 1, richness: 2 },
      { id: 'lab_core', name: '核心反应炉', nameEn: 'Reactor Core', exits: { south: 'lab_a' }, danger: 3, richness: 3 },
    ],
  },
  {
    id: 'forest',
    name: '雾隐森林',
    nameEn: 'Misty Forest',
    icon: '🌲',
    description: '永恒之雾笼罩，古树记得每个过客的名字',
    descriptionEn: 'Veiled in eternal mist, ancient trees remember every passerby',
    color: '#4a7c59',
    rooms: [
      { id: 'forest_trail', name: '林间小径', nameEn: 'Forest Trail', exits: { east: 'plaza_west', north: 'forest_lake', west: 'forest_cabin' }, danger: 1, richness: 1 },
      { id: 'forest_lake', name: '月光湖', nameEn: 'Moon Lake', exits: { south: 'forest_trail', north: 'forest_shrine' }, danger: 1, richness: 2 },
      { id: 'forest_cabin', name: '猎人小屋', nameEn: 'Hunter Cabin', exits: { east: 'forest_trail' }, danger: 1, richness: 1 },
      { id: 'forest_shrine', name: '古老神祠', nameEn: 'Old Shrine', exits: { south: 'forest_lake', north: 'forest_heart' }, danger: 2, richness: 3 },
      { id: 'forest_heart', name: '森林之心', nameEn: 'Heart of Forest', exits: { south: 'forest_shrine' }, danger: 2, richness: 3 },
    ],
  },
  {
    id: 'ocean',
    name: '蔚蓝深渊',
    nameEn: 'Azure Depths',
    icon: '🌊',
    description: '潮汐吞没的古文明，海底宫殿仍在呼吸',
    descriptionEn: 'A drowned ancient civilization, its undersea palace still breathing',
    color: '#2e7d9b',
    rooms: [
      { id: 'ocean_shore', name: '礁海岸', nameEn: 'Reef Shore', exits: { north: 'plaza_south', south: 'ocean_cave' }, danger: 1, richness: 1 },
      { id: 'ocean_cave', name: '潮汐洞窟', nameEn: 'Tide Cave', exits: { north: 'ocean_shore', south: 'ocean_wreck' }, danger: 1, richness: 2 },
      { id: 'ocean_wreck', name: '沉没巨轮', nameEn: 'Sunken Wreck', exits: { north: 'ocean_cave', south: 'ocean_trench' }, danger: 2, richness: 2 },
      { id: 'ocean_trench', name: '深海海沟', nameEn: 'Abyss Trench', exits: { north: 'ocean_wreck', south: 'ocean_palace' }, danger: 3, richness: 3 },
      { id: 'ocean_palace', name: '海底宫殿', nameEn: 'Sea Palace', exits: { north: 'ocean_trench' }, danger: 2, richness: 3 },
    ],
  },
  {
    id: 'city',
    name: '霓虹街区',
    nameEn: 'Neon District',
    icon: '🌃',
    description: '永不熄灭的雨夜霓虹，情报与危险同样密集',
    descriptionEn: 'Neon that never sleeps in the rainy night — intel and danger in equal measure',
    color: '#ff4d8d',
    rooms: [
      { id: 'city_alley', name: '雨巷', nameEn: 'Rain Alley', exits: { west: 'plaza_east', north: 'city_market', east: 'lab_lobby' }, danger: 1, richness: 1 },
      { id: 'city_market', name: '夜市', nameEn: 'Night Market', exits: { south: 'city_alley', north: 'city_rooftop' }, danger: 1, richness: 2 },
      { id: 'city_rooftop', name: '天台', nameEn: 'Rooftop', exits: { south: 'city_market', north: 'city_club' }, danger: 1, richness: 1 },
      { id: 'city_club', name: '地下俱乐部', nameEn: 'Underground Club', exits: { south: 'city_rooftop', east: 'city_vault' }, danger: 2, richness: 2 },
      { id: 'city_vault', name: '金库', nameEn: 'Vault', exits: { west: 'city_club' }, danger: 3, richness: 3 },
    ],
  },
  {
    id: 'tavern',
    name: '归人酒馆',
    nameEn: 'Hearth Tavern',
    icon: '🍺',
    description: '所有故事的起点与终点，炉火永不熄灭',
    descriptionEn: 'Where every story begins and ends, the hearth never goes out',
    color: '#d4a574',
    rooms: [
      { id: 'tavern_door', name: '酒馆门前', nameEn: 'Tavern Door', exits: { west: 'plaza_center', east: 'tavern_hall' }, danger: 0, richness: 1 },
      { id: 'tavern_hall', name: '喧闹大厅', nameEn: 'Tavern Hall', exits: { west: 'tavern_door', south: 'tavern_cellar', north: 'tavern_attic' }, danger: 0, richness: 2 },
      { id: 'tavern_cellar', name: '酒窖密道', nameEn: 'Cellar Passage', exits: { north: 'tavern_hall' }, danger: 1, richness: 2 },
      { id: 'tavern_attic', name: '阁楼密室', nameEn: 'Attic Secret', exits: { south: 'tavern_hall' }, danger: 1, richness: 2 },
    ],
  },
  {
    id: 'academy',
    name: '星辰学院',
    nameEn: 'Astral Academy',
    icon: '🔮',
    description: '漂浮的星图与禁忌知识，学者们追逐永恒',
    descriptionEn: 'Floating star maps and forbidden knowledge, where scholars chase eternity',
    color: '#7c5cff',
    rooms: [
      { id: 'academy_gate', name: '学院正门', nameEn: 'Academy Gate', exits: { south: 'plaza_north', north: 'academy_library' }, danger: 0, richness: 1 },
      { id: 'academy_library', name: '星图图书馆', nameEn: 'Star Library', exits: { south: 'academy_gate', north: 'academy_tower', west: 'academy_lab' }, danger: 1, richness: 2 },
      { id: 'academy_tower', name: '观星塔', nameEn: 'Observatory', exits: { south: 'academy_library', north: 'academy_vault' }, danger: 1, richness: 3 },
      { id: 'academy_lab', name: '炼金工坊', nameEn: 'Alchemy Lab', exits: { east: 'academy_library' }, danger: 2, richness: 2 },
      { id: 'academy_vault', name: '禁书库', nameEn: 'Forbidden Vault', exits: { south: 'academy_tower' }, danger: 3, richness: 3 },
    ],
  },
]

export function buildInitialWorldState(): WorldMudState {
  const now = Date.now()
  const districts: WorldDistrict[] = WORLD_DISTRICTS_TEMPLATE.map((d) => ({
    ...d,
    rooms: d.rooms.map((r) => ({ ...r, districtId: d.id } as WorldRoom)),
  }))
  return {
    worldId: WORLD_ID,
    version: 1,
    createdAt: now,
    updatedAt: now,
    loreTitle: '永恒沙漏',
    loreTitleEn: 'The Eternal Hourglass',
    lore: '在这座被时间遗忘的城市里，每个人都只有一小时。沙漏永不停止流转，而世界因每一个抵达的灵魂而悄然改变。没有注定的结局，只有你们共同书写的历史。',
    loreEn: 'In a city forgotten by time, each soul has but one hour. The hourglass never stops, and the world shifts with every arrival. No destiny is fixed — history is what you make together.',
    districts,
    npcs: [
      { id: 'npc_elara', name: '艾菈', nameEn: 'Elara', role: '酒馆老板娘', districtId: 'tavern', roomId: 'tavern_hall', mood: 'friendly', memory: [] },
      { id: 'npc_orion', name: '奥瑞恩', nameEn: 'Orion', role: '遗迹守望者', districtId: 'ruin', roomId: 'ruin_gate', mood: 'mysterious', memory: [] },
      { id: 'npc_mira', name: '米拉', nameEn: 'Mira', role: '星辰导师', districtId: 'academy', roomId: 'academy_library', mood: 'friendly', memory: [] },
      { id: 'npc_jax', name: '杰克斯', nameEn: 'Jax', role: '夜市情报贩子', districtId: 'city', roomId: 'city_market', mood: 'neutral', memory: [] },
    ],
    globalEvent: null,
    players: [],
    log: [],
    stats: { totalActions: 0, totalPlayersEver: 0, totalRoomsDiscovered: 1, dayCount: 1 },
    motd: '沙漏刚刚翻转，新的故事等待被书写。',
    motdEn: 'The hourglass has turned anew. A new story awaits.',
  }
}

export function findRoom(state: WorldMudState, roomId: string): WorldRoom | null {
  for (const d of state.districts) {
    const r = d.rooms.find((x) => x.id === roomId)
    if (r) return r
  }
  return null
}

export function findDistrict(state: WorldMudState, districtId: DistrictId): WorldDistrict | null {
  return state.districts.find((d) => d.id === districtId) ?? null
}

export function allRooms(state: WorldMudState): WorldRoom[] {
  return state.districts.flatMap((d) => d.rooms)
}
