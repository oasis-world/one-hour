import type { StyleDefinition } from '@dicebear/core'
import adventurer from '@dicebear/styles/adventurer.json'
import bottts from '@dicebear/styles/bottts.json'
import funEmoji from '@dicebear/styles/fun-emoji.json'
import lorelei from '@dicebear/styles/lorelei.json'
import notionists from '@dicebear/styles/notionists.json'
import thumbs from '@dicebear/styles/thumbs.json'

/**
 * The full DiceBear style catalog (61 shipped, `initials` excluded — it
 * renders the seed as text, meaningless for random seeds). The classic
 * six stay statically bundled as an offline baseline; every other style
 * is a lazy chunk that loads the first time it is picked or previewed.
 */

const BUNDLED: Record<string, StyleDefinition> = {
  adventurer: adventurer as StyleDefinition,
  bottts: bottts as StyleDefinition,
  'fun-emoji': funEmoji as StyleDefinition,
  lorelei: lorelei as StyleDefinition,
  notionists: notionists as StyleDefinition,
  thumbs: thumbs as StyleDefinition,
}

const LAZY: Record<string, () => Promise<{ default: unknown }>> = {
  'adventurer-neutral': () => import('@dicebear/styles/adventurer-neutral.json'),
  avataaars: () => import('@dicebear/styles/avataaars.json'),
  'avataaars-neutral': () => import('@dicebear/styles/avataaars-neutral.json'),
  'big-ears': () => import('@dicebear/styles/big-ears.json'),
  'big-ears-neutral': () => import('@dicebear/styles/big-ears-neutral.json'),
  'big-smile': () => import('@dicebear/styles/big-smile.json'),
  blobs: () => import('@dicebear/styles/blobs.json'),
  'bottts-neutral': () => import('@dicebear/styles/bottts-neutral.json'),
  cameo: () => import('@dicebear/styles/cameo.json'),
  clay: () => import('@dicebear/styles/clay.json'),
  constellation: () => import('@dicebear/styles/constellation.json'),
  critters: () => import('@dicebear/styles/critters.json'),
  croodles: () => import('@dicebear/styles/croodles.json'),
  'croodles-neutral': () => import('@dicebear/styles/croodles-neutral.json'),
  cutouts: () => import('@dicebear/styles/cutouts.json'),
  disco: () => import('@dicebear/styles/disco.json'),
  dylan: () => import('@dicebear/styles/dylan.json'),
  gaze: () => import('@dicebear/styles/gaze.json'),
  glass: () => import('@dicebear/styles/glass.json'),
  glyphs: () => import('@dicebear/styles/glyphs.json'),
  icons: () => import('@dicebear/styles/icons.json'),
  identicon: () => import('@dicebear/styles/identicon.json'),
  'initial-face': () => import('@dicebear/styles/initial-face.json'),
  landscape: () => import('@dicebear/styles/landscape.json'),
  'line-face': () => import('@dicebear/styles/line-face.json'),
  loops: () => import('@dicebear/styles/loops.json'),
  'lorelei-neutral': () => import('@dicebear/styles/lorelei-neutral.json'),
  marbles: () => import('@dicebear/styles/marbles.json'),
  micah: () => import('@dicebear/styles/micah.json'),
  miniavs: () => import('@dicebear/styles/miniavs.json'),
  moods: () => import('@dicebear/styles/moods.json'),
  'notionists-neutral': () => import('@dicebear/styles/notionists-neutral.json'),
  'open-peeps': () => import('@dicebear/styles/open-peeps.json'),
  patchwork: () => import('@dicebear/styles/patchwork.json'),
  personas: () => import('@dicebear/styles/personas.json'),
  'pixel-art': () => import('@dicebear/styles/pixel-art.json'),
  'pixel-art-neutral': () => import('@dicebear/styles/pixel-art-neutral.json'),
  pixelbot: () => import('@dicebear/styles/pixelbot.json'),
  planets: () => import('@dicebear/styles/planets.json'),
  rings: () => import('@dicebear/styles/rings.json'),
  shadows: () => import('@dicebear/styles/shadows.json'),
  'shape-grid': () => import('@dicebear/styles/shape-grid.json'),
  shapes: () => import('@dicebear/styles/shapes.json'),
  slice: () => import('@dicebear/styles/slice.json'),
  sprouts: () => import('@dicebear/styles/sprouts.json'),
  squircles: () => import('@dicebear/styles/squircles.json'),
  stack: () => import('@dicebear/styles/stack.json'),
  stripes: () => import('@dicebear/styles/stripes.json'),
  'toon-head': () => import('@dicebear/styles/toon-head.json'),
  triangles: () => import('@dicebear/styles/triangles.json'),
  'voxel-art': () => import('@dicebear/styles/voxel-art.json'),
  'voxel-bot': () => import('@dicebear/styles/voxel-bot.json'),
  waves: () => import('@dicebear/styles/waves.json'),
  weave: () => import('@dicebear/styles/weave.json'),
}

/** Every style the picker and the randomizer can produce. */
export const STYLE_IDS: readonly string[] = [
  ...Object.keys(BUNDLED),
  ...Object.keys(LAZY),
].sort()

export function isKnownStyle(id: unknown): id is string {
  return typeof id === 'string' && (id in BUNDLED || id in LAZY)
}

/** Human label for the picker: "lorelei-neutral" → "Lorelei Neutral". */
export function styleTitle(id: string): string {
  return id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const loaded = new Map<string, StyleDefinition>(Object.entries(BUNDLED))
const pending = new Map<string, Promise<void>>()

/** Resolve a style definition; bundled ones are ready immediately. */
export function getStyleDefinition(id: string): StyleDefinition | null {
  return loaded.get(id) ?? null
}

/** Fetch an unbundled style chunk once; resolves even on failure. */
export function ensureStyleLoaded(id: string): Promise<void> {
  if (loaded.has(id)) return Promise.resolve()
  const inflight = pending.get(id)
  if (inflight) return inflight
  const loader = LAZY[id]
  if (!loader) return Promise.resolve()
  const task = loader()
    .then((mod) => {
      loaded.set(id, mod.default as StyleDefinition)
    })
    .catch(() => {
      // Chunk unavailable (offline): previews fall back, random skips it.
    })
    .finally(() => {
      pending.delete(id)
    })
  pending.set(id, task)
  return task
}
