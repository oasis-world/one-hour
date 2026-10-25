/**
 * Random fullscreen backdrop feed. With VITE_UNSPLASH_ACCESS_KEY set, the
 * official Unsplash API picks the photo; without a key the keyless
 * picsum.photos feed stands in (its library is Unsplash-sourced), so the
 * backdrop works out of the box either way.
 */

const UNSPLASH_KEY = (import.meta.env.VITE_UNSPLASH_ACCESS_KEY ?? '').trim()

export async function fetchRandomBackgroundUrl(): Promise<string | null> {
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

/** Resolve before swapping layers, so a dead URL never blanks the stage. */
export function preloadImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = url
  })
}
