import { getSupabaseClient } from './supabaseClient'
import { isSupabaseConfigured } from './supabaseConfig'
import { withTimeout } from './withTimeout'
import type { ResonanceQuestion, ResonanceVote } from '../games/resonance/types'

/**
 * DB-backed data layer for the Resonance game. Dedicated tables hold the
 * AI-generated questions (one row per card) and the ballots. Live tally
 * updates flow through a single `postgres_changes` subscription on the votes
 * table — no Realtime broadcast channel, no host-election, no per-card socket.
 */

const ROUNDS = 'resonance_rounds'
const VOTES = 'resonance_votes'
const TIMEOUT = 15_000

interface RoundRow {
  instance_id: string
  questions: unknown
  created_at: string
  expires_at: string
}

interface VoteRow {
  instance_id: string
  round: number
  user_id: string
  option_index: number
  display_name: string | null
  avatar_style: string | null
  avatar_seed: string | null
  avatar_url: string | null
  created_at: string
}

async function client() {
  if (!isSupabaseConfigured()) return null
  try {
    const supa = await getSupabaseClient()
    const { data } = await supa.auth.getSession()
    return data.session?.user?.id ? supa : null
  } catch {
    return null
  }
}

function toQuestions(options: unknown): ResonanceQuestion[] {
  if (!Array.isArray(options)) return []
  return options.filter((o): o is ResonanceQuestion =>
    Boolean(o && typeof o === 'object' && 'prompt' in o && Array.isArray((o as ResonanceQuestion).options)),
  )
}

export function validInstanceId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

export interface ResonanceData {
  questions: ResonanceQuestion[]
  createdAt: number
  expiresAt: number
}

export async function loadResonance(instanceId: string): Promise<ResonanceData | null> {
  const supa = await client()
  if (!supa || !validInstanceId(instanceId)) return null
  try {
    const { data, error } = await withTimeout(
      supa.from(ROUNDS).select('instance_id,questions,created_at,expires_at').eq('instance_id', instanceId).maybeSingle(),
      TIMEOUT,
    )
    if (error || !data) return null
    const row = data as RoundRow
    return {
      questions: toQuestions(row.questions),
      createdAt: new Date(row.created_at).getTime(),
      expiresAt: new Date(row.expires_at).getTime(),
    }
  } catch {
    return null
  }
}

export async function createResonance(input: {
  instanceId: string
  questions: ResonanceQuestion[]
  expiresAt: number
}): Promise<boolean> {
  const supa = await client()
  if (!supa || !validInstanceId(input.instanceId) || input.questions.length === 0) return false
  try {
    const { error } = await withTimeout(
      supa.from(ROUNDS).insert({
        instance_id: input.instanceId,
        questions: input.questions,
        expires_at: new Date(input.expiresAt).toISOString(),
      }),
      TIMEOUT,
    )
    return !error // duplicate (race) is fine — another client won
  } catch {
    return false
  }
}

export async function loadVotes(instanceId: string): Promise<ResonanceVote[]> {
  const supa = await client()
  if (!supa || !validInstanceId(instanceId)) return []
  try {
    const { data, error } = await withTimeout(
      supa.from(VOTES)
        .select('instance_id,round,user_id,option_index,display_name,avatar_style,avatar_seed,avatar_url,created_at')
        .eq('instance_id', instanceId),
      TIMEOUT,
    )
    if (error || !data) return []
    return (data as VoteRow[]).map((r) => ({
      instanceId: r.instance_id,
      round: r.round,
      userId: r.user_id,
      // option ids are letters a/b/c/d at the position stored as option_index.
      optionId: String.fromCharCode(97 + r.option_index),
      displayName: r.display_name ?? '旅人',
      avatarStyle: r.avatar_style ?? '',
      avatarSeed: r.avatar_seed ?? r.user_id,
      avatarUrl: r.avatar_url ?? null,
      createdAt: new Date(r.created_at).getTime(),
    }))
  } catch {
    return []
  }
}

export interface VoteInput {
  instanceId: string
  round: number
  userId: string
  optionIndex: number
  displayName: string
  avatarStyle: string
  avatarSeed: string
  avatarUrl: string | null
}

export async function castResonanceVote(input: VoteInput): Promise<boolean> {
  const supa = await client()
  if (!supa || !validInstanceId(input.instanceId)) return false
  try {
    await withTimeout(supa.from(VOTES).delete()
      .eq('instance_id', input.instanceId).eq('round', input.round).eq('user_id', input.userId), TIMEOUT)
    const { error } = await withTimeout(
      supa.from(VOTES).insert({
        instance_id: input.instanceId,
        round: input.round,
        user_id: input.userId,
        option_index: input.optionIndex,
        display_name: input.displayName,
        avatar_style: input.avatarStyle,
        avatar_seed: input.avatarSeed,
        avatar_url: input.avatarUrl,
      }),
      TIMEOUT,
    )
    return !error
  } catch {
    return false
  }
}

/** Remove this voter's ballot for a round (used by the "change vote" action). */
export async function clearResonanceVote(instanceId: string, round: number, userId: string): Promise<boolean> {
  const supa = await client()
  if (!supa || !validInstanceId(instanceId)) return false
  try {
    const q = supa.from(VOTES).delete().eq('instance_id', instanceId).eq('round', round).eq('user_id', userId)
    const { error } = await withTimeout(q, TIMEOUT)
    return !error
  } catch {
    return false
  }
}

/** One channel subscribing to all vote changes for this card. */
export function subscribeResonanceVotes(instanceId: string, onChange: () => void): () => void {
  let disposed = false
  let stop: (() => void) | null = null
  void (async () => {
    const supa = await client()
    if (!supa || disposed || !validInstanceId(instanceId)) return
    const channel = supa.channel(`resonance:${instanceId}`)
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: VOTES, filter: `instance_id=eq.${instanceId}` },
      onChange)
    await channel.subscribe()
    if (disposed) void supa.removeChannel(channel)
    else stop = () => void supa.removeChannel(channel)
  })()
  return () => { disposed = true; stop?.() }
}
