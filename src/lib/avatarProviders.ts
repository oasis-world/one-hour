import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import BoringAvatar from 'boring-avatars'
import multiavatar from '@multiavatar/multiavatar'
import { toSvg as jdenticonSvg } from 'jdenticon'

/**
 * Extra avatar families alongside the 60+ DiceBear styles:
 *  - Boring Avatars (8 geometric variants, rendered to static SVG)
 *  - Multiavatar (multicultural illustrated characters)
 *  - Jdenticon (deterministic identicons)
 *
 * All three are deterministic per seed and render synchronously, so they
 * plug into the same `<img src={dataUri}>` pipeline as DiceBear — no extra
 * React tree, no network requests, and every existing avatar surface gets
 * the new families for free.
 */

const BORING_VARIANTS = [
  'beam', 'bauhaus', 'geometric', 'marble',
  'pixel', 'ring', 'sunset', 'abstract',
] as const

type BoringVariant = (typeof BORING_VARIANTS)[number]

/** Style ids usable anywhere a DiceBear style id is (look.style). */
export const EXTRA_STYLE_IDS: readonly string[] = [
  ...BORING_VARIANTS.map((variant) => `boring-${variant}`),
  'multiavatar',
  'jdenticon',
]

const EXTRA_SET = new Set<string>(EXTRA_STYLE_IDS)

export function isExtraStyle(id: unknown): id is string {
  return typeof id === 'string' && EXTRA_SET.has(id)
}

const svgUri = (svg: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

/** Render one of the extra families; null only if the library threw. */
export function renderExtraStyle(style: string, seed: string): string | null {
  try {
    if (style === 'multiavatar') return svgUri(multiavatar(seed))
    if (style === 'jdenticon') return svgUri(jdenticonSvg(seed, 128))
    if (style.startsWith('boring-')) {
      const variant = style.slice('boring-'.length) as BoringVariant
      const svg = renderToStaticMarkup(
        createElement(BoringAvatar, { name: seed, variant, size: 128 }),
      )
      return svgUri(svg)
    }
  } catch {
    return null
  }
  return null
}

/** "boring-beam" → "Boring Beam"; spelled-out ids keep the picker readable. */
export function extraStyleTitle(id: string): string {
  return id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
