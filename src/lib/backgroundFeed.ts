/**
 * Background photo pipeline, in priority order:
 *  1. Picsum — cheap, random, no auth. Its redirect is resolved to the exact
 *     photo id, whose Unsplash page becomes the globe link (+ credit).
 *  2. Unsplash via the Supabase Edge Function — curated photo + credit.
 *  3. A small shuffled pool of six stable Unsplash CDN photos.
 *
 * The Unsplash path is deliberately only attempted after Picsum fails: it
 * may wait for a session token before calling the Edge Function.
 */

import { isSupabaseConfigured } from './supabaseConfig'
import { getSupabaseClient } from './supabaseClient'

const FALLBACK_PHOTOS = [
  'photo-1500530855697-b586d89ba3ee',
  'photo-1470770841072-f978cf4d019e',
  'photo-1501785888041-af3ef285b470',
  'photo-1470252649378-9c29740c9fa8',
  'photo-1441974231531-c6227db76b6e',
  'photo-1464822759023-fed622ff2c3b',
]

export interface BackgroundPhoto {
  /** Direct URL of a successfully preloaded image. */
  url: string
  /** Source URL of the image shown. */
  source: string | null
  credit?: { name: string; url: string } | null
}

function isNarrowScreen(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return (
      window.innerWidth < 768 ||
      window.matchMedia?.('(orientation: portrait)').matches === true
    )
  } catch {
    return window.innerWidth < 768
  }
}

function fallbackUrl(photo: string, narrow: boolean): string {
  const width = narrow ? 1080 : 1920
  const height = narrow ? 1920 : 1080
  return `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${width}&h=${height}&q=80`
}

function fallbackUrls(narrow: boolean): string[] {
  return [...FALLBACK_PHOTOS]
    .sort(() => Math.random() - .5)
    .map((photo) => fallbackUrl(photo, narrow))
}

async function pickUnsplashPhoto(): Promise<BackgroundPhoto | null> {
  if (!isSupabaseConfigured()) return null
  const narrow = isNarrowScreen()
  try {
    const client = await getSupabaseClient()
    const token = await waitForSessionToken(client)
    if (!token) return null
    const { data, error } = await client.functions.invoke<{
      imageUrl: string
      sourceUrl: string
      photographerName: string
      photographerUrl: string
    }>('unsplash-background', {
      body: { orientation: narrow ? 'portrait' : 'landscape' },
      headers: { Authorization: `Bearer ${token}` },
    })
    if (error || !data?.imageUrl || !data.sourceUrl || !data.photographerName || !data.photographerUrl) return null
    return {
      url: data.imageUrl,
      source: data.sourceUrl,
      credit: { name: data.photographerName, url: data.photographerUrl },
    }
  } catch {
    // Missing deployment, auth, or network → fall through to Picsum.
  }
  return null
}

async function waitForSessionToken(client: Awaited<ReturnType<typeof getSupabaseClient>>): Promise<string | null> {
  for (let attempt = 0; attempt < 7; attempt++) {
    try {
      const { data } = await client.auth.getSession()
      if (data.session?.access_token) return data.session.access_token
    } catch {
      // Auth may still be restoring the local session.
    }
    if (attempt < 6) await new Promise((resolve) => window.setTimeout(resolve, 350))
  }
  return null
}

interface PicsumInfo {
  id: string
  author?: string
  /** Original photo page on Unsplash. */
  url?: string
}

/** Budget for the two small metadata requests used to resolve a Picsum photo. */
const PICSUM_META_TIMEOUT_MS = 4000

/**
 * Fetch a Picsum photo and resolve its exact identity:
 *  - `fetch` follows Picsum's 302 to the final CDN image URL, so the <img>
 *    paints the very same photo the globe link should lead to;
 *  - the exposed `Picsum-Id` header + `/id/{id}/info` give the photographer
 *    and the original Unsplash page for the credit + link.
 *
 * If only the metadata request fails, the final CDN image URL becomes the
 * link; if even the first fetch fails, the plain volatile URL is used so a
 * Picsum hiccup never blanks the backdrop.
 */
async function pickPicsumPhoto(narrow: boolean): Promise<BackgroundPhoto | null> {
  const seed = Math.random().toString(36).slice(2, 10)
  const width = narrow ? 1080 : 1920
  const height = narrow ? 1920 : 1080
  const picsumUrl = `https://picsum.photos/${width}/${height}?random=${seed}`
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), PICSUM_META_TIMEOUT_MS)

  try {
    const res = await fetch(picsumUrl, { signal: controller.signal })
    if (!res.ok) throw new Error('Picsum fetch failed')
    const finalUrl = res.url || picsumUrl
    // The <img> below loads the image; don't keep the fetch body in memory.
    if (res.body) void res.body.cancel().catch(() => {})

    const id = res.headers.get('Picsum-Id')
    let source = finalUrl
    let credit: { name: string; url: string } | null = null
    if (id) {
      try {
        const infoRes = await fetch(`https://picsum.photos/id/${encodeURIComponent(id)}/info`, {
          signal: controller.signal,
        })
        if (infoRes.ok) {
          const info = await infoRes.json() as PicsumInfo
          if (info.url) source = info.url
          if (info.author) credit = { name: info.author, url: source }
        }
      } catch {
        // Metadata is optional: keep the final image URL as the link.
      }
    }
    return loadDirectly({ url: finalUrl, source, credit })
  } catch {
    // No metadata (offline / CORS / timeout): keep the image working with
    // the plain Picsum URL, as before.
    return loadDirectly({ url: picsumUrl, source: picsumUrl })
  } finally {
    window.clearTimeout(timer)
  }
}

function loadDirectly(photo: BackgroundPhoto): Promise<BackgroundPhoto | null> {
  return new Promise((resolve) => {
    const image = new Image()
    let settled = false
    const finish = (photo: BackgroundPhoto | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      image.onload = null
      image.onerror = null
      resolve(photo)
    }
    const timer = window.setTimeout(() => finish(null), 7000)
    image.onload = () => finish(photo)
    image.onerror = () => finish(null)
    image.src = photo.url
  })
}

export async function fetchRandomBackground(): Promise<BackgroundPhoto | null> {
  const narrow = isNarrowScreen()

  // 1. Picsum first. Don't await the Unsplash session/function unless this
  //    actually fails — otherwise every rotation pays that latency.
  const picsum = await pickPicsumPhoto(narrow)
  if (picsum) return picsum

  // 2. Server-side Unsplash photo (with photographer credit).
  const unsplashPhoto = await pickUnsplashPhoto()
  if (unsplashPhoto) {
    const loaded = await loadDirectly(unsplashPhoto)
    if (loaded) return loaded
  }

  // 3. Last resort: the six stable Unsplash CDN photos, shuffled.
  for (const url of fallbackUrls(narrow)) {
    const photo = await loadDirectly({ url, source: url })
    if (photo) return photo
  }
  return null
}
