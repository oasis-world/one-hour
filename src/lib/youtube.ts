/**
 * YouTube link detection + embed helpers.
 *
 * Used by MessageRow to render an inline player when a message contains
 * a YouTube URL. Kept framework-free so it can be unit-tested / reused.
 */

export interface YouTubeVideo {
  id: string
  url: string
}

const YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be',
])

/** Extract the 11-char video id from a single URL string, or null. */
export function extractYouTubeId(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  if (!YT_HOSTS.has(host)) return null

  let id: string | null = null
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    id = url.pathname.split('/').filter(Boolean)[0] ?? null
  } else if (url.pathname === '/watch') {
    id = url.searchParams.get('v')
  } else {
    // /embed/ID, /shorts/ID, /v/ID, /live/ID
    const m = url.pathname.match(/^\/(?:embed|shorts|v|live)\/([^/?#]+)/)
    if (m) id = m[1]
  }
  if (!id) return null
  // Strip any trailing junk and validate shape (11 chars, url-safe).
  id = id.split(/[?&#]/)[0]
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null
  return id
}

/** Find all YouTube videos referenced in a free-form text. De-dupes by id. */
export function findYouTubeVideos(text: string): YouTubeVideo[] {
  if (!text) return []
  // Match candidate URLs (http/https, optional www, with optional path/query).
  const re = /https?:\/\/[^\s<>"')]+/gi
  const found: YouTubeVideo[] = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const url = m[0].replace(/[.,;:!?)]+$/, '')
    const id = extractYouTubeId(url)
    if (id && !seen.has(id)) {
      seen.add(id)
      found.push({ id, url })
    }
  }
  return found
}

export function youtubeEmbedSrc(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`
}