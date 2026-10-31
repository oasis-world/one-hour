import { isSupabaseConfigured } from './account'
import { getSupabaseClient } from './supabaseClient'
import { isKnownStyle } from './avatar'
import type { UserProfile } from './userProfile'

const TABLE = 'profiles'

interface ProfileRow {
  nickname: string
  avatar_style: string
  avatar_seed: string
  avatar_url: string | null
  role: string | null
  expires_at: string | null
}

export interface CloudProfileSnapshot {
  profile: UserProfile
  expiresAt: number | null
}

/** Read any authenticated room member's profile for the message avatar card. */
export async function fetchCloudProfile(userId: string, signal?: AbortSignal): Promise<CloudProfileSnapshot | null> {
  if (!isSupabaseConfigured()) return null
  try {
    if (signal?.aborted) return null
    const client = await getSupabaseClient()
    if (signal?.aborted) return null
    const read = () => {
      const query = client.from(TABLE)
        .select('nickname, avatar_style, avatar_seed, avatar_url, role, expires_at')
        .eq('user_id', userId)
      if (signal) query.abortSignal(signal)
      return query.maybeSingle()
    }
    let result = await read()
    if (result.error && isMissingColumn(result.error)) {
      const query = client.from(TABLE)
        .select('nickname, avatar_style, avatar_seed')
        .eq('user_id', userId)
      if (signal) query.abortSignal(signal)
      result = await query.maybeSingle()
    }
    if (signal?.aborted || result.error || !result.data) return null
    const row = result.data as ProfileRow
    if (typeof row.nickname !== 'string' || !isKnownStyle(row.avatar_style) || typeof row.avatar_seed !== 'string') return null
    const parsedExpiry = row.expires_at ? Date.parse(row.expires_at) : NaN
    return {
      profile: {
        nickname: row.nickname,
        role: row.role ?? '',
        style: row.avatar_style,
        seed: row.avatar_seed,
        avatarUrl: row.avatar_url ?? null,
      },
      expiresAt: Number.isFinite(parsedExpiry) ? parsedExpiry : null,
    }
  } catch {
    return null
  }
}

function isMissingColumn(error: { message?: string; code?: string }): boolean {
  return error.code === '42703' || /column .*avatar_url does not exist/i.test(error.message ?? '')
}
