import { Avatar, Style, type StyleOptions } from '@dicebear/core'
import { STYLE_IDS, getStyleDefinition, isKnownStyle } from './avatarStyles'

/**
 * DiceBear rendering (dicebear.com, offline via @dicebear): a look is a
 * style id + seed pair. Random looks roll across the whole catalog; the
 * definition chunks load on demand (see avatarStyles.ts), so callers
 * render `avatarDataUri()` and fall back while it returns null.
 */

export interface AvatarLook {
  style: string
  seed: string
}

/** Fixed render size — the SVG scales losslessly to any CSS size. */
const RENDER_SIZE = 128

/** Soft pastel backdrop so faces read on both the dark and warm themes. */
const BACKGROUNDS = ['#b6e3f4', '#c0aede', '#d1d4f9', '#ffd5dc', '#ffdfbf']

/** Style + seed → data URI, memoized (presence lists re-render a lot). */
const uriCache = new Map<string, string>()
const URI_CACHE_MAX = 160

export { STYLE_IDS, ensureStyleLoaded, isKnownStyle, styleTitle } from './avatarStyles'

export function randomAvatarSeed(): string {
  return Math.random().toString(36).slice(2, 10)
}

/** A fresh look across the full catalog, never an exact repeat. */
export function randomAvatarLook(previous?: AvatarLook | null): AvatarLook {
  const style = STYLE_IDS[Math.floor(Math.random() * STYLE_IDS.length)]
  let seed = randomAvatarSeed()
  while (previous && previous.seed === seed) seed = randomAvatarSeed()
  return { style, seed }
}

/**
 * `<img src>` data URI. Null while that style's chunk is still loading
 * (callers show a placeholder and retry via ensureStyleLoaded); unknown
 * style ids fall back to lorelei.
 */
export function avatarDataUri(
  look: AvatarLook | null | undefined,
): string | null {
  if (!look) return fallbackGlyphUri()
  const style = isKnownStyle(look.style) ? look.style : 'lorelei'
  const key = `${style}:${look.seed}`
  const hit = uriCache.get(key)
  if (hit) return hit
  const definition = getStyleDefinition(style)
  if (!definition) return null
  const uri = render(style, look.seed)
  if (uriCache.size >= URI_CACHE_MAX) uriCache.clear()
  uriCache.set(key, uri)
  return uri
}

/** Neutral placeholder face (always bundled, never null). */
function fallbackGlyphUri(): string {
  const cached = uriCache.get('fallback')
  if (cached) return cached
  const uri = render('lorelei', 'one-hour')
  uriCache.set('fallback', uri)
  return uri
}

interface AvatarOptions {
  seed: string
  size: number
  backgroundColor: string[]
}

/**
 * Generic `Style` keeps per-style color names out of the static type,
 * though `backgroundColor` is the shared runtime option — hence the cast.
 */
const avatarOptions = (seed: string): AvatarOptions & StyleOptions => ({
  seed,
  size: RENDER_SIZE,
  backgroundColor: BACKGROUNDS,
})

function render(style: string, seed: string): string {
  const definition = getStyleDefinition(style) ?? getStyleDefinition('lorelei')!
  return new Avatar(new Style(definition), avatarOptions(seed)).toDataUri()
}
