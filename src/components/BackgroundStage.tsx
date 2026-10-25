import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchRandomBackground, type BackgroundPhoto } from '../lib/backgroundFeed'
import { loadBgTtlMs } from '../lib/settings'
import BgSlotRing from './BgSlotRing'

/** How often the stage checks whether the current photo's slot is over. */
const ROTATE_CHECK_MS = 10_000

/**
 * The dynamic backdrop:
 *  - The newest photo in the chat paints the stage the moment it lands.
 *  - With no chat photo (fresh room, or all expired), a random photo from
 *    the background feed (Unsplash API / keyless stand-in) fills in.
 *  - The ten-minute rule: whatever is on screen — chat photo or feed photo —
 *    steps down after its slot (loadBgTtlMs(), default 10 min) and a fresh
 *    feed photo crossfades in. A *newer* chat photo still wins instantly.
 *
 * While the chat is folded away (`revealed`), a small ring-only countdown
 * of the current photo's slot sits in the bottom-right corner.
 */
export default function BackgroundStage({
  imageUrl,
  revealed,
}: {
  imageUrl: string | null
  revealed: boolean
}) {
  const [fallback, setFallback] = useState<BackgroundPhoto | null>(null)
  /** Chat photo that already served its full slot — it yields to the feed. */
  const [demotedUrl, setDemotedUrl] = useState<string | null>(null)

  const liveChat = imageUrl && imageUrl !== demotedUrl ? imageUrl : null
  const live = liveChat ?? fallback?.url ?? null
  /** Feed photos link to their resolved source; chat photos stay private. */
  const cornerLink = liveChat ? null : (fallback?.source ?? null)

  // Refs for the async rotate() — kept fresh in effects (never in render).
  const latestImageRef = useRef(imageUrl)
  const liveRef = useRef(live)
  const rotatingRef = useRef(false)
  const sinceRef = useRef(0)
  /** Slot start time, mirrored into state for the corner ring. */
  const [slotSince, setSlotSince] = useState(0)
  useEffect(() => {
    latestImageRef.current = imageUrl
  }, [imageUrl])
  useEffect(() => {
    liveRef.current = live
  }, [live])

  const rotate = useCallback(async () => {
    if (rotatingRef.current) return
    rotatingRef.current = true
    try {
      // fetchRandomBackground resolves the blob first — a dead URL or a
      // CORS wall never blanks the stage.
      const photo = await fetchRandomBackground()
      if (!photo) return
      const current = liveRef.current
      if (current && current === latestImageRef.current) {
        // The chat photo on screen held its full slot — demote it. A newer
        // chat photo (different URL) still takes over immediately after.
        setDemotedUrl(current)
      }
      setFallback((prev) => {
        if (prev?.url.startsWith('blob:')) URL.revokeObjectURL(prev.url)
        return photo
      })
    } finally {
      rotatingRef.current = false
    }
  }, [])

  // The slot timer (and the no-photo-yet fetch). Re-armed whenever `live`
  // changes: each photo's slot starts the moment it goes on screen — a
  // chat photo that just took over must NOT inherit the previous photo's
  // elapsed time (it would be demoted instantly).
  useEffect(() => {
    sinceRef.current = Date.now()
    setSlotSince(sinceRef.current)
    const check = () => {
      if (!liveRef.current) {
        void rotate() // fresh visit / everything expired — fetch a feed photo
      } else if (Date.now() - sinceRef.current >= loadBgTtlMs()) {
        void rotate() // slot over — step the current photo down
      }
    }
    check()
    const timer = setInterval(check, ROTATE_CHECK_MS)
    return () => clearInterval(timer)
  }, [live, rotate])

  // Crossfade layers: the incoming photo fades over the outgoing one.
  const [layers, setLayers] = useState<{ id: number; url: string }[]>(() =>
    live ? [{ id: 0, url: live }] : [],
  )
  const seqRef = useRef(1)

  useEffect(() => {
    if (!live) return
    setLayers((prev) => {
      if (prev.some((layer) => layer.url === live)) return prev
      return [...prev, { id: seqRef.current++, url: live }].slice(-2)
    })
  }, [live])

  // Trim the faded-out layer once the crossfade settles.
  useEffect(() => {
    if (layers.length <= 1) return
    const timer = setTimeout(() => {
      setLayers((prev) => prev.slice(-1))
    }, 1400)
    return () => clearTimeout(timer)
  }, [layers])

  return (
    <div className="bg-stage" aria-hidden="true">
      {layers.map((layer, index) => (
        <div
          key={layer.id}
          className={`bg-layer${index === layers.length - 1 ? ' is-live' : ''}`}
          style={{ backgroundImage: `url(${layer.url})` }}
        />
      ))}
      <div className="bg-blur" />
      <div className="bg-scrim" />
      {revealed && live && <BgSlotRing since={slotSince} link={cornerLink} />}
    </div>
  )
}
