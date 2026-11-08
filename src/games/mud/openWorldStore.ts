// Normalized open-world data layer (Supabase + local fallback).
import { getSupabaseClient } from '../../lib/supabaseClient'
import { isSupabaseConfigured } from '../../lib/supabaseConfig'
import { VAULT_KEYS, vaultGetSync } from '../../lib/vault'
import {
  normalizeAnswer, sha256Hex, realmLevelFromXp, realmTitleOf, PUZZLE_SEEDS,
  type OpenWorldSnapshot, type PlayerProfileRow,
} from './openWorldTypes'
import type { Lang } from '../../lib/i18n'
import { WORLD_DISTRICTS_TEMPLATE } from './worldTypes'

const LS_SNAP = 'one-hour:openworld:snapshot'
const LS_PROFILE = 'one-hour:openworld:profile'

function localUserId(): string {
  try {
    const raw = vaultGetSync(VAULT_KEYS.localUid)
    if (raw) return raw
  } catch { /* noop */ }
  try {
    const u = (globalThis as unknown as { crypto?: Crypto }).crypto
    if (u?.randomUUID) return u.randomUUID()
  } catch { /* noop */ }
  return `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

function readLocalProfile(): PlayerProfileRow | null {
  try {
    const raw = localStorage.getItem(LS_PROFILE)
    if (!raw) return null
    const p = JSON.parse(raw) as PlayerProfileRow
    if (!p.user_id) return null
    return p
  } catch { return null }
}

function saveLocalProfile(p: PlayerProfileRow) {
  try { localStorage.setItem(LS_PROFILE, JSON.stringify(p)) } catch { /* noop */ }
}


function seedRooms() {
  return WORLD_DISTRICTS_TEMPLATE.flatMap((d) =>
    d.rooms.map((r) => ({
      id: r.id, region_id: d.id, world_id: 'main',
      name_zh: r.name, name_en: r.nameEn, exits: r.exits,
      danger: r.danger, richness: r.richness, is_hidden: false,
    })),
  )
}

function fallbackSnapshot(userId: string, displayName: string, lang: Lang): OpenWorldSnapshot {
  const lp = readLocalProfile()
  const profile: PlayerProfileRow | null = lp ?? {
    user_id: userId, display_name: displayName, realm_level: 1, xp: 0,
    realm_title: realmTitleOf(1, lang), equipped: {}, total_solved: 0,
  }
  const rooms = seedRooms()
  const regions = WORLD_DISTRICTS_TEMPLATE.map((d, i) => ({ id: d.id, world_id: 'main', display_order: i, unlocked: true }))
  const items = [
    { id: 'item-tide-pouch', name: '潮痕囊', name_en: 'Tide Pouch', icon: '🎒', rarity: 'common' as const, slot: 'pouch' as const, description: '收纳潮汐碎片', stats: { capacity: 20 } },
  ]
  return {
    world: { id: 'main', phase: lang === 'en' ? 'Genesis Phase' : '启元期', epoch: 1, solved_puzzles: 0, total_puzzles: 12, updated_at: new Date().toISOString() },
    regions, rooms, items,
    puzzles: [], tasks: [], myProfile: profile, leaderboard: [profile],
    log: [], events: [], myHelp: [], mySolvedIds: [],
  }
}

async function ensurePuzzlesSeeded(client: Awaited<ReturnType<typeof getSupabaseClient>>): Promise<boolean> {
  const { data: existing } = await client.from('puzzles').select('id').limit(1)
  if (existing && existing.length > 0) return false
  // FK order matters: worlds → regions → rooms → items → puzzles.
  // If the full schema.sql has not been run yet (no rooms in DB), the
  // puzzles upsert would violate puzzles_room_id_fkey — seed parents first.
  const regionRows = WORLD_DISTRICTS_TEMPLATE.map((d, i) => ({ id: d.id, world_id: 'main', display_order: i, unlocked: true }))
  await client.from('worlds').upsert({ id: 'main', phase: '启元期', epoch: 1, total_puzzles: 12 }, { onConflict: 'id', ignoreDuplicates: true })
  await client.from('regions').upsert(regionRows, { onConflict: 'id', ignoreDuplicates: true })
  const roomRows = WORLD_DISTRICTS_TEMPLATE.flatMap((d) => d.rooms.map((r) => ({ id: r.id, region_id: d.id, world_id: 'main', name_zh: r.name, name_en: r.nameEn, exits: r.exits, danger: r.danger, richness: r.richness, is_hidden: false })))
  await client.from('rooms').upsert(roomRows, { onConflict: 'id', ignoreDuplicates: true })
  const itemRows = [
    { id: 'item-tide-blade', name: '汐刃', name_en: 'Tide Blade', icon: '🗡️', rarity: 'rare', slot: 'weapon', description: '引汐成刃', stats: { attack: 15 } },
    { id: 'item-dawn-amulet', name: '破晓护符', name_en: 'Dawn Amulet', icon: '🛡️', rarity: 'rare', slot: 'amulet', description: '护符微光', stats: { defense: 12 } },
    { id: 'item-star-compass', name: '星引罗盘', name_en: 'Star Compass', icon: '🧭', rarity: 'epic', slot: 'compass', description: '指引封印方位', stats: { explore: 10 } },
    { id: 'item-tide-pouch', name: '潮痕囊', name_en: 'Tide Pouch', icon: '🎒', rarity: 'common', slot: 'pouch', description: '收纳潮汐碎片', stats: { capacity: 20 } },
    { id: 'item-abyss-lantern', name: '渊灯', name_en: 'Abyss Lantern', icon: '🔦', rarity: 'epic', slot: 'compass', description: '照亮深渊裂隙', stats: { light: 15 } },
    { id: 'item-gold-key', name: '金钥', name_en: 'Golden Key', icon: '🔑', rarity: 'legendary', slot: 'pouch', description: '打开禁书库的钥匙', stats: { key: 1 } },
    { id: 'item-moon-vial', name: '月光药剂', name_en: 'Moonlight Vial', icon: '🧪', rarity: 'common', slot: 'pouch', description: '恢复汐力', stats: { heal: 20 } },
    { id: 'item-tide-core', name: '汐核', name_en: 'Tide Core', icon: '💠', rarity: 'legendary', slot: 'amulet', description: '启元期核心碎片', stats: { core: 1 } },
  ]
  await client.from('items').upsert(itemRows, { onConflict: 'id', ignoreDuplicates: true })
  const hashes = await Promise.all(PUZZLE_SEEDS.map(async (s) => ({
    id: s.id, room_id: s.room, region_id: s.region,
    title: s.titleZh, riddle: `${s.riddleZh}\n---\n${s.riddleEn}`,
    answer_hash: await sha256Hex(normalizeAnswer(s.answer)),
    hint: `${s.hintZh} / ${s.hintEn}`,
    reward_xp: s.xp, reward_item_id: s.item, status: 'open', solver_count: 0,
  })))
  // Upsert with ignoreDuplicates: concurrent first-boots from multiple players
  // all race to insert the same 12 seeds — last writer wins, no 409.
  const { error } = await client.from('puzzles').upsert(hashes, { onConflict: 'id', ignoreDuplicates: true })
  if (error) console.warn('[open-world] seed upsert:', error.message)
  return true
}

export async function loadSnapshot(displayName: string, lang: Lang): Promise<{ snap: OpenWorldSnapshot; userId: string }> {
  const userId = localUserId()
  if (!isSupabaseConfigured()) {
    return { snap: fallbackSnapshot(userId, displayName, lang), userId }
  }
  try {
    const client = await getSupabaseClient()
    const { data: { user } } = await client.auth.getUser()
    const uid = user?.id ?? userId
    await ensurePuzzlesSeeded(client)

    const [worldRes, regionsRes, roomsRes, itemsRes, puzzlesRes, tasksRes, logRes, eventsRes, profileRes, boardRes, helpRes] = await Promise.all([
      client.from('worlds').select('*').eq('id', 'main').maybeSingle(),
      client.from('regions').select('*').order('display_order'),
      client.from('rooms').select('*'),
      client.from('items').select('*'),
      client.from('puzzles').select('*').order('created_at'),
      client.from('player_tasks').select('*').eq('status', 'approved').order('created_at', { ascending: false }).limit(20),
      client.from('world_log').select('*').order('at', { ascending: false }).limit(30),
      client.from('world_events').select('*').order('created_at', { ascending: false }).limit(3),
      client.from('player_profiles').select('*').eq('user_id', uid).maybeSingle(),
      client.from('player_profiles').select('*').order('xp', { ascending: false }).limit(10),
      client.from('player_help_qa').select('*').eq('user_id', uid).order('at', { ascending: false }).limit(10),
    ])
    const world = worldRes.data ?? fallbackSnapshot(uid, displayName, lang).world
    const rooms = (roomsRes.data ?? []) as OpenWorldSnapshot['rooms']
    const myProfile = profileRes.data
      ? (profileRes.data as PlayerProfileRow)
      : await createProfile(client, uid, displayName, lang)
    const { data: progress } = await client.from('player_progress').select('puzzle_id').eq('user_id', uid)
    const snap: OpenWorldSnapshot = {
      world, regions: regionsRes.data ?? [], rooms: rooms.length ? rooms : seedRooms(),
      items: itemsRes.data ?? [], puzzles: puzzlesRes.data ?? [], tasks: tasksRes.data ?? [],
      myProfile, leaderboard: boardRes.data ?? [], log: logRes.data ?? [],
      events: eventsRes.data ?? [], myHelp: helpRes.data ?? [],
      mySolvedIds: (progress ?? []).map((r) => (r as { puzzle_id: string }).puzzle_id),
    }
    try { localStorage.setItem(LS_SNAP, JSON.stringify({ at: Date.now() })) } catch { /* noop */ }
    return { snap, userId: uid }
  } catch {
    return { snap: fallbackSnapshot(userId, displayName, lang), userId }
  }
}

async function createProfile(client: Awaited<ReturnType<typeof getSupabaseClient>>, uid: string, displayName: string, lang: Lang): Promise<PlayerProfileRow> {
  const row: PlayerProfileRow = { user_id: uid, display_name: displayName, realm_level: 1, xp: 0, realm_title: realmTitleOf(1, lang), equipped: {}, total_solved: 0 }
  // Upsert with ignoreDuplicates so double-tab / StrictMode double-mount never 409s.
  await client.from('player_profiles').upsert(
    { user_id: uid, display_name: displayName, realm_level: 1, xp: 0, realm_title: row.realm_title },
    { onConflict: 'user_id', ignoreDuplicates: true },
  )
  const { data } = await client.from('player_profiles').select('*').eq('user_id', uid).maybeSingle()
  return (data as PlayerProfileRow) ?? row
}

export async function submitPuzzleAnswer(
  snap: OpenWorldSnapshot, userId: string, puzzleId: string, rawAnswer: string, lang: Lang,
): Promise<{ ok: boolean; xpGain: number; newProfile: PlayerProfileRow }> {
  const puzzle = snap.puzzles.find((p) => p.id === puzzleId)
  const profile = snap.myProfile
  if (!puzzle || !profile) return { ok: false, xpGain: 0, newProfile: profile ?? { user_id: userId, display_name: '', realm_level: 1, xp: 0, realm_title: '', equipped: {}, total_solved: 0 } }
  const hash = await sha256Hex(normalizeAnswer(rawAnswer))
  if (hash !== puzzle.answer_hash) return { ok: false, xpGain: 0, newProfile: profile }
  if (!isSupabaseConfigured()) {
    const np = { ...profile, xp: profile.xp + puzzle.reward_xp, total_solved: profile.total_solved + 1 }
    np.realm_level = realmLevelFromXp(np.xp); np.realm_title = realmTitleOf(np.realm_level, lang)
    saveLocalProfile(np)
    return { ok: true, xpGain: puzzle.reward_xp, newProfile: np }
  }
  try {
    const client = await getSupabaseClient()
    if (snap.mySolvedIds.includes(puzzleId)) return { ok: false, xpGain: 0, newProfile: profile }
    const { error: pe } = await client.from('player_progress').upsert({ user_id: userId, puzzle_id: puzzleId, attempts: 0 }, { onConflict: 'user_id,puzzle_id', ignoreDuplicates: true })
    if (pe) return { ok: false, xpGain: 0, newProfile: profile }
    const np = { ...profile, xp: profile.xp + puzzle.reward_xp, total_solved: profile.total_solved + 1 }
    np.realm_level = realmLevelFromXp(np.xp); np.realm_title = realmTitleOf(np.realm_level, lang)
    await client.from('player_profiles').update({ xp: np.xp, realm_level: np.realm_level, realm_title: np.realm_title, total_solved: np.total_solved, updated_at: new Date().toISOString() }).eq('user_id', userId)
    await client.from('world_log').insert({ user_id: userId, display_name: profile.display_name, location_id: puzzle.room_id, action: puzzle.title, result: `+${puzzle.reward_xp} XP`, kind: 'puzzle', lang })
    return { ok: true, xpGain: puzzle.reward_xp, newProfile: np }
  } catch {
    return { ok: true, xpGain: puzzle.reward_xp, newProfile: profile }
  }
}

export async function appendLog(userId: string, displayName: string, roomId: string, action: string, result: string, lang: Lang, kind = 'action') {
  if (!isSupabaseConfigured()) return
  try {
    const client = await getSupabaseClient()
    await client.from('world_log').insert({ user_id: userId, display_name: displayName, location_id: roomId, action, result, kind, lang })
  } catch { /* noop */ }
}

export async function requestGenerateTask(prompt: string, roomId: string, regionId: string, lang: Lang): Promise<{ title: string; desc: string; rewardXp: number; rewardItemId: string | null } | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const client = await getSupabaseClient()
    const { data, error } = await client.functions.invoke('world-mud-generate-task', { body: { prompt, roomId, regionId, lang } })
    if (error || !data) return null
    return {
      title: String(data.title ?? '').slice(0, 60), desc: String(data.desc ?? '').slice(0, 300),
      rewardXp: typeof data.rewardXp === 'number' ? data.rewardXp : 15,
      rewardItemId: typeof data.reward_item_id === 'string' ? data.reward_item_id : null,
    }
  } catch { return null }
}

export async function requestGuide(question: string, lang: Lang): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const client = await getSupabaseClient()
    const { data, error } = await client.functions.invoke('world-mud-guide', { body: { question, lang } })
    if (error || !data || typeof data.answer !== 'string') return null
    return data.answer as string
  } catch { return null }
}
