import { Avatar, Style, type StyleOptions } from '@dicebear/core'
import {
  STYLE_IDS as DICEBEAR_STYLE_IDS,
  getStyleDefinition,
  isKnownStyle as isDicebearStyle,
  styleTitle as dicebearStyleTitle,
} from './avatarStyles'
import {
  EXTRA_STYLE_IDS,
  extraStyleTitle,
  isExtraStyle,
  renderExtraStyle,
} from './avatarProviders'

/**
 * Avatar rendering: a look is a style id + seed pair. The 60+ DiceBear
 * styles are the original catalog; Boring Avatars, Multiavatar and
 * Jdenticon add ten deterministic families on top (see avatarProviders.ts).
 * Random looks roll across all of them, so the space is style × seed.
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

/** Every style the picker and the randomizer can produce. */
export const STYLE_IDS: readonly string[] = [...DICEBEAR_STYLE_IDS, ...EXTRA_STYLE_IDS]

export { ensureStyleLoaded } from './avatarStyles'

export function isKnownStyle(id: unknown): id is string {
  return isDicebearStyle(id) || isExtraStyle(id)
}

export function styleTitle(id: string): string {
  return isExtraStyle(id) ? extraStyleTitle(id) : dicebearStyleTitle(id)
}

export function randomAvatarSeed(): string {
  return Math.random().toString(36).slice(2, 14)
}

/** A fresh look across every family, never an exact style+seed repeat. */
export function randomAvatarLook(previous?: AvatarLook | null): AvatarLook {
  let look: AvatarLook
  do {
    look = {
      style: STYLE_IDS[Math.floor(Math.random() * STYLE_IDS.length)]!,
      seed: randomAvatarSeed(),
    }
  } while (previous && previous.style === look.style && previous.seed === look.seed)
  return look
}

/**
 * `<img src>` data URI. Null while a DiceBear chunk is still loading
 * (callers show a placeholder and retry via ensureStyleLoaded); the extra
 * families render synchronously. Unknown style ids fall back to lorelei.
 */
export function avatarDataUri(
  look: AvatarLook | null | undefined,
): string | null {
  if (!look) return fallbackGlyphUri()
  const style = isKnownStyle(look.style) ? look.style : 'lorelei'
  const key = `${style}:${look.seed}`
  const hit = uriCache.get(key)
  if (hit) return hit
  const uri = render(style, look.seed)
  if (!uri) return null
  if (uriCache.size >= URI_CACHE_MAX) uriCache.clear()
  uriCache.set(key, uri)
  return uri
}

/** Neutral placeholder face (always bundled, never null). */
function fallbackGlyphUri(): string {
  const cached = uriCache.get('fallback')
  if (cached) return cached
  const uri = new Avatar(
    new Style(getStyleDefinition('lorelei')!),
    avatarOptions('one-hour'),
  ).toDataUri()
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

function render(style: string, seed: string): string | null {
  if (isExtraStyle(style)) {
    // A failed extra-family render falls back to the bundled face rather
    // than leaving an empty slot waiting on a chunk that never loads.
    return renderExtraStyle(style, seed)
      ?? new Avatar(new Style(getStyleDefinition('lorelei')!), avatarOptions(seed)).toDataUri()
  }
  // Null while a lazy DiceBear chunk is in flight: AvatarBadge waits and
  // retries via ensureStyleLoaded instead of showing the wrong face.
  const definition = getStyleDefinition(style)
  if (!definition) return null
  return new Avatar(new Style(definition), avatarOptions(seed)).toDataUri()
}
