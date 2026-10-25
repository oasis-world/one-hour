/**
 * Random fullscreen backdrop feed. With VITE_UNSPLASH_ACCESS_KEY set, the
 * official Unsplash API picks the photo; without a key the keyless
 * picsum.photos feed stands in (its library is Unsplash-sourced), so the
 * backdrop works out of the box either way.
 *
 * The photo is fetched (redirects followed) and displayed from a local
 * blob, and the *resolved* URL is kept as its source: picsum's
 * `?random=` URLs redirect to a different photo on every request, so
 * only the final URL truthfully identifies what is on screen.
 */

const UNSPLASH_KEY = (import.meta.env.VITE_UNSPLASH_ACCESS_KEY ?? '').trim()

export interface BackgroundPhoto {
  /** Blob URL for display — stable, already fully loaded. */
  url: string
  /** Resolved (redirect-followed) URL of the very image shown. */
  source: string | null
}

async function pickFeedUrl(): Promise<string> {
  if (UNSPLASH_KEY) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/photos/random?orientation=landscape&client_id=${encodeURIComponent(UNSPLASH_KEY)}`,
      )
      if (res.ok) {
        const data = (await res.json()) as {
          urls?: { raw?: string; regular?: string; full?: string }
        }
        const raw = data.urls?.raw
        if (raw) return `${raw}&w=1920&q=80&fm=jpg`
        if (data.urls?.regular) return data.urls.regular
        if (data.urls?.full) return data.urls.full
      }
    } catch {
      // Offline / rate-limited → fall through to the keyless feed.
    }
  }
  const seed = Math.random().toString(36).slice(2, 10)
  return `https://picsum.photos/1920/1080?random=${seed}`
}

export async function fetchRandomBackground(): Promise<BackgroundPhoto | null> {
  const feedUrl = await pickFeedUrl()
  try {
    const res = await fetch(feedUrl)
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return null
    // res.url is post-redirect — exactly the photo the blob contains.
    return { url: URL.createObjectURL(blob), source: res.url }
  } catch {
    // CORS or offline: no truthful source link, and an unloaded image
    // would risk a blank stage — skip this round.
    return null
  }
}
