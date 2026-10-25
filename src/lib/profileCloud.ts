import { isSupabaseConfigured, subscribeAccount, type AccountState } from './account'
import { getSupabaseClient } from './supabaseClient'
import { loadUserProfile, randomProfile, saveUserProfile } from './userProfile'
import { isKnownStyle } from './avatar'
import type { UserProfile } from './userProfile'

/**
 * Cloud profile sync for the `profiles` table: local-only for guests and
 * anonymous players; the moment an email identity lands (sign up / bind /
 * sign in) the local profile is pushed up — or, when the account already
 * has a saved row, that row wins and replaces the local one so the same
 * face follows the player across devices.
 */

const TABLE = 'profiles'

interface ProfileRow {
  nickname: string
  avatar_style: string
  avatar_seed: string
  avatar_url: string | null
}

/** Upsert the current local profile; fire-and-forget safe. */
export async function pushProfileToCloud(): Promise<void> {
  const profile = loadUserProfile()
  if (!isSupabaseConfigured() || !profile) return
  try {
    const client = await getSupabaseClient()
    const { data } = await client.auth.getSession()
    const uid = data.session?.user?.id
    if (!uid) return
    const row = {
      user_id: uid,
      nickname: profile.nickname,
      avatar_style: profile.style,
      avatar_seed: profile.seed,
      avatar_url: profile.avatarUrl ?? null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await client.from(TABLE).upsert(row)
    if (error && isMissingColumn(error)) {
      // Schema predates the avatar_url column — write what exists.
      const base: Record<string, unknown> = { ...row }
      delete base.avatar_url
      await client.from(TABLE).upsert(base)
    }
  } catch {
    // Offline or table missing: the local copy remains the source of truth.
  }
}

/** Load the signed-in player's row into the local store. False = none. */
export async function pullCloudProfile(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  try {
    const client = await getSupabaseClient()
    const { data } = await client.auth.getSession()
    const uid = data.session?.user?.id
    if (!uid) return false
    const query = () => client.from(TABLE).select('nickname, avatar_style, avatar_seed, avatar_url')
    let res = await query().eq('user_id', uid).maybeSingle()
    if (res.error && isMissingColumn(res.error)) {
      // Schema predates the avatar_url column — read what exists.
      res = await client
        .from(TABLE)
        .select('nickname, avatar_style, avatar_seed')
        .eq('user_id', uid)
        .maybeSingle()
    }
    if (res.error || !res.data) return false
    const row = res.data as ProfileRow
    if (
      typeof row.nickname !== 'string' ||
      row.nickname.length === 0 ||
      typeof row.avatar_seed !== 'string' ||
      !isKnownStyle(row.avatar_style)
    ) {
      return false
    }
    const cloud: UserProfile = {
      nickname: row.nickname.slice(0, 20),
      style: row.avatar_style,
      seed: row.avatar_seed,
      avatarUrl: row.avatar_url ?? null,
    }
    if (JSON.stringify(cloud) !== JSON.stringify(loadUserProfile())) {
      saveUserProfile(cloud)
    }
    return true
  } catch {
    return false
  }
}

/** Postgres "column does not exist" (schema not migrated to avatar_url). */
function isMissingColumn(error: { message?: string; code?: string }): boolean {
  return (
    error.code === '42703' || /column .*avatar_url does not exist/i.test(error.message ?? '')
  )
}

let watching = false

/**
 * Account-profile lifecycle, one sync per transition:
 *  - guest→signedIn (bootstrap restore, email confirm, sign-in dialog):
 *    the cloud row wins when present, otherwise the local look goes up.
 *  - signedIn→out (sign out): the device returns to a fresh traveler —
 *    the account's photo and nickname belong to the account, not to
 *    this browser. The reset waits for any in-flight pull to settle so
 *    the row cannot be re-applied after the reset; signing back in
 *    during that window cancels it. Idempotent across StrictMode mounts.
 */
export function watchAccountForProfileSync(): void {
  if (watching) return
  watching = true
  let last: AccountState['status'] = 'guest'
  let inflight: Promise<void> | null = null
  subscribeAccount((state) => {
    const was = last
    last = state.status

    if (state.status === 'signedIn') {
      if (was === 'signedIn' || inflight) return
      inflight = pullCloudProfile()
        .then((found) => {
          // Signed out while the pull was in the air: push nothing.
          if (last === 'signedIn' && !found) return pushProfileToCloud()
        })
        .finally(() => {
          inflight = null
        })
      return
    }

    if (was !== 'signedIn') return
    const reset = () => {
      if (last === 'signedIn') return
      saveUserProfile(randomProfile(loadUserProfile()))
    }
    if (inflight) void inflight.then(reset, reset)
    else reset()
  })
}
