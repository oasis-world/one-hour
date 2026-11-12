/**
 * Prefer a server-side Unsplash photo when Supabase and its Edge Function
 * are configured. Fall back to Picsum, then a small stable Unsplash CDN pool.
 *
 * If Picsum is unavailable, try a small pool of stable Unsplash CDN photos.
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
  const unsplashPhoto = await pickUnsplashPhoto()
  const seed = Math.random().toString(36).slice(2, 10)
  const width = narrow ? 1080 : 1920
  const height = narrow ? 1920 : 1080
  const picsumUrl = `https://picsum.photos/${width}/${height}?random=${seed}`
  const candidates: BackgroundPhoto[] = [
    ...(unsplashPhoto ? [unsplashPhoto] : []),
    { url: picsumUrl, source: picsumUrl },
    ...fallbackUrls(narrow).map((url) => ({ url, source: url })),
  ]
  for (const candidate of candidates) {
    const photo = await loadDirectly(candidate)
    if (photo) return photo
  }
  return null
}
