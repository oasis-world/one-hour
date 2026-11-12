import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

type Orientation = 'portrait' | 'landscape'
const cache = new Map<Orientation, { body: UnsplashPhoto; expiresAt: number }>()

interface UnsplashPhoto {
  imageUrl: string
  sourceUrl: string
  photographerName: string
  photographerUrl: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!await isAuthenticatedUser(request)) return json({ error: 'Authentication required' }, 401)

  let orientation: Orientation = 'landscape'
  try {
    const body = await request.json()
    if (body?.orientation === 'portrait' || body?.orientation === 'landscape') orientation = body.orientation
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const cached = cache.get(orientation)
  if (cached && cached.expiresAt > Date.now()) return json(cached.body)
  const key = Deno.env.get('UNSPLASH_ACCESS_KEY')
  if (!key) return json({ error: 'Unsplash is not configured' }, 503)

  try {
    const response = await fetch(`https://api.unsplash.com/photos/random?orientation=${orientation}`, {
      headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) {
      console.warn('[unsplash-background] upstream returned', response.status)
      return json({ error: 'Unsplash request failed' }, response.status === 429 ? 503 : 502)
    }
    const photo = await response.json() as {
      urls?: { raw?: string }
      links?: { html?: string }
      user?: { name?: string; links?: { html?: string } }
    }
    if (!photo.urls?.raw || !photo.links?.html || !photo.user?.name || !photo.user.links?.html) {
      return json({ error: 'Unsplash returned incomplete photo data' }, 502)
    }
    const image = new URL(photo.urls.raw)
    image.searchParams.set('auto', 'format')
    image.searchParams.set('fit', 'crop')
    image.searchParams.set('w', orientation === 'portrait' ? '1080' : '1920')
    image.searchParams.set('h', orientation === 'portrait' ? '1920' : '1080')
    image.searchParams.set('q', '80')
    const result: UnsplashPhoto = {
      imageUrl: image.toString(),
      sourceUrl: withAttribution(photo.links.html),
      photographerName: photo.user.name,
      photographerUrl: withAttribution(photo.user.links.html),
    }
    cache.set(orientation, { body: result, expiresAt: Date.now() + 55 * 60_000 })
    return json(result)
  } catch (error) {
    console.error('[unsplash-background] request failed', (error as Error)?.name ?? 'unknown')
    return json({ error: 'Unsplash is temporarily unavailable' }, 502)
  }
})

function withAttribution(value: string): string {
  const url = new URL(value)
  url.searchParams.set('utm_source', 'one_hour')
  url.searchParams.set('utm_medium', 'referral')
  return url.toString()
}

async function isAuthenticatedUser(request: Request): Promise<boolean> {
  const authorization = request.headers.get('authorization')
  const projectUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? defaultPublishableKey()
  if (!authorization?.startsWith('Bearer ') || !projectUrl || !anonKey) return false
  try {
    const response = await fetch(`${projectUrl}/auth/v1/user`, {
      headers: { authorization, apikey: anonKey },
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}

function defaultPublishableKey(): string | undefined {
  try { return JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}').default } catch { return undefined }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json', 'cache-control': 'private, max-age=300' },
  })
}
