import { useEffect, useState } from 'react'
import { avatarDataUri, ensureStyleLoaded } from '../lib/avatar'

/**
 * Loose look shape: an optional custom-photo URL wins over the DiceBear
 * style + seed (`url` at call sites, `avatarUrl` when a UserProfile is
 * passed whole); presence peers carry free strings, and the renderer
 * validates the style name itself (unknown names fall back to lorelei).
 */
export interface AvatarBadgeLook {
  style: string
  seed: string
  url?: string | null
  avatarUrl?: string | null
}

/**
 * One face, everywhere: renders a DiceBear look (style + seed) as a
 * rounded <img>. Styles outside the bundled six load their chunk on
 * demand — until then a neutral disc holds the slot. Callers without a
 * look at all (presence peers on older clients) render their own letter
 * tile instead.
 */
export default function AvatarBadge({
  look,
  size,
  className = '',
  rounded = true,
  draggable = false,
  fill = false,
}: {
  look: AvatarBadgeLook | null | undefined
  /** Ignored with `fill` — CSS then owns the box (e.g. a ringed button). */
  size?: number
  className?: string
  rounded?: boolean
  draggable?: boolean
  fill?: boolean
}) {
  const photo = look ? (look.url ?? look.avatarUrl ?? null) : null
  const uri = photo ?? avatarDataUri(look)
  const [retry, setRetry] = useState(0)

  // Chunk still in flight: subscribe and re-render when it lands.
  useEffect(() => {
    if (uri || !look || photo) return
    let alive = true
    void ensureStyleLoaded(look.style).then(() => {
      if (alive) setRetry((n) => n + 1)
    })
    return () => {
      alive = false
    }
  }, [uri, look, photo, retry])

  const box = fill
    ? undefined
    : { width: size, height: size, borderRadius: rounded ? '50%' : undefined }

  if (!uri) {
    return (
      <span
        className={`avatar-pending${className ? ` ${className}` : ''}`}
        style={box}
        aria-hidden="true"
      />
    )
  }

  return (
    <img
      className={className}
      src={uri}
      width={fill ? undefined : size}
      height={fill ? undefined : size}
      style={box}
      alt=""
      aria-hidden="true"
      draggable={draggable}
    />
  )
}
