import { signOutAccount } from './account'
import {
  clearProfileExpiresAt,
  clearUserProfile,
  getProfileExpiresAt,
  resetPreWelcome,
} from './userProfile'
import { isSupabaseConfigured } from './supabaseConfig'
import { getSupabaseClient } from './supabaseClient'
import { resetLocalUserId } from './identity'

/**
 * Anonymous users live for exactly one hour. When that hour runs out, the
 * local profile + cloud profile row are removed and a fresh anonymous
 * identity is created, so the welcome gate reappears.
 *
 * Sign-in/sign-out entry points are disabled (experiment) — only anonymous
 * identities exist, so "delete" here means purge the profile and recreate
 * the anonymous session.
 */
export async function deleteCloudProfileRow(): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    const client = await getSupabaseClient()
    const { data } = await client.auth.getSession()
    const uid = data.session?.user?.id
    if (!uid) return
    // Remove custom avatar objects first (all avatar-* files in the user's
    // folder), so a vanished profile leaves no orphaned photo behind.
    try {
      const { data: files } = await client.storage.from('chat-images').list(uid, { limit: 100 })
      const avatarPaths = (files ?? [])
        .filter((f) => f.name.startsWith('avatar-'))
        .map((f) => `${uid}/${f.name}`)
      if (avatarPaths.length > 0) {
        await client.storage.from('chat-images').remove(avatarPaths)
      }
    } catch {
      // Best effort: the scheduled sweep will catch leftovers.
    }
    await client.from('profiles').delete().eq('user_id', uid)
  } catch {
    // Offline: best effort.
  }
}

export async function expireAnonymousProfile(): Promise<void> {
  await deleteCloudProfileRow()
  clearUserProfile()
  clearProfileExpiresAt()
  resetPreWelcome()
  resetLocalUserId()
  await signOutAccount()
}

export { getProfileExpiresAt }