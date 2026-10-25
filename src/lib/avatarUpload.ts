import { getSupabaseClient } from './supabaseClient'
import { isSupabaseConfigured } from './supabaseConfig'
import { fileToAvatarImage } from './imageBlob'

/**
 * Custom photo avatars: the picked file becomes a 256px center-cropped
 * JPEG in the public chat-images bucket under the player's own folder
 * (bucket policy already allows writes there), and the public URL is
 * what every client renders. Offline / unconfigured → null and the
 * DiceBear look stays.
 */

const IMAGES_BUCKET = 'chat-images'

export async function uploadAvatarImage(file: File | Blob): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const blob = await fileToAvatarImage(file)
    const client = await getSupabaseClient()
    const { data } = await client.auth.getSession()
    const uid = data.session?.user?.id
    if (!uid) return null
    // New name per upload: browsers and other clients must not see a
    // stale cached copy after a change.
    const path = `${uid}/avatar-${Date.now()}.jpg`
    const { error } = await client.storage
      .from(IMAGES_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (error) return null
    return client.storage.from(IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
  } catch {
    return null
  }
}
