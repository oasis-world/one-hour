import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useLang, t } from '../lib/i18n'
import { ThinXIcon } from './icons'

/**
 * Fullscreen photo viewer as a three-cell film strip: the current photo
 * centered with its neighbors parked one screen to each side. At rest a
 * horizontal drag moves the strip under the finger (rubber-banded at the
 * ends); releasing past the threshold glides into the neighbor, anything
 * less springs back — browsing feels like sliding real photos. Vertical
 * fling dismisses, double-tap toggles zoom, pinch zooms 1×..4× (floor at
 * the fitted size), and a zoomed photo pans under one finger.
 */

const MAX_SCALE = 4
const DOUBLE_TAP_SCALE = 2.5
const TAP_SLOP_PX = 8
const DOUBLE_TAP_MS = 300
const GLIDE_MS = 240

interface Zoom {
  x: number
  y: number
  s: number
}

const ZOOM_NONE: Zoom = { x: 0, y: 0, s: 1 }

export default function ImageViewer({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: string[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}) {
  useLang()
  const [stripX, setStripX] = useState(0)
  const [followY, setFollowY] = useState(0)
  const [dim, setDim] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [snap, setSnap] = useState(false) // jump without transition (post-glide)
  const [zoom, setZoom] = useState<Zoom>(ZOOM_NONE)
  const imgRef = useRef<HTMLImageElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const drag = useRef<{
    px: number
    py: number
    t: number
    moved: boolean
    onImg: boolean
    zoom: Zoom
    /** Seeded when a pinch drops to one finger — the final lift must do
        nothing (no tap, no pager glide), only hand control back. */
    fromPinch?: boolean
  } | null>(null)
  const pinch = useRef<{ dist: number; zoom: Zoom; mx: number; my: number } | null>(null)
  const lastTap = useRef(0)
  const glideTimer = useRef<number | null>(null)

  const canPrev = index > 0
  const canNext = index < images.length - 1

  useEffect(
    () => () => {
      if (glideTimer.current) window.clearTimeout(glideTimer.current)
    },
    [],
  )

  const switchTo = (next: number) => {
    setZoom(ZOOM_NONE)
    setStripX(0)
    setFollowY(0)
    setDim(0)
    onIndexChange(next)
  }

  /**
   * iOS Safari ignores `touch-action: none` (and user-scalable=no) for
   * pinch gestures and takes the gesture over for page zoom — the viewer
   * then only sees pointercancel and the photo never zooms. A native
   * non-passive touchmove preventDefault (React's synthetic touch
   * listeners are passive and cannot stop the takeover) keeps both
   * fingers' pointer events flowing to the custom pinch handler below.
   * There is no native scrolling inside the viewer to preserve.
   */
  const viewerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = viewerRef.current
    if (!el) return
    const stopDefault = (e: Event) => e.preventDefault()
    el.addEventListener('touchmove', stopDefault, { passive: false })
    // Legacy iOS pinch event — belt and suspenders next to touchmove.
    el.addEventListener('gesturestart', stopDefault as EventListener)
    return () => {
      el.removeEventListener('touchmove', stopDefault)
      el.removeEventListener('gesturestart', stopDefault as EventListener)
    }
  }, [])

  /** Keyboard: Esc leaves, arrows jump a photo. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' && canNext) switchTo(index + 1)
      else if (e.key === 'ArrowLeft' && canPrev) switchTo(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, canPrev, canNext])

  /** Keep the zoomed photo from being panned fully off the screen. */
  const clampPan = (z: Zoom): Zoom => {
    const el = imgRef.current
    if (!el) return z
    const maxX = Math.max(0, (z.s * el.offsetWidth - window.innerWidth) / 2)
    const maxY = Math.max(0, (z.s * el.offsetHeight - window.innerHeight) / 2)
    return {
      s: z.s,
      x: Math.min(maxX, Math.max(-maxX, z.x)),
      y: Math.min(maxY, Math.max(-maxY, z.y)),
    }
  }

  /** Glide out toward the neighbor, then swap indices in place. */
  const glide = (dir: 1 | -1) => {
    setDragging(false)
    setStripX(-dir * window.innerWidth)
    setFollowY(0)
    setDim(0)
    if (glideTimer.current) window.clearTimeout(glideTimer.current)
    glideTimer.current = window.setTimeout(() => {
      glideTimer.current = null
      // The neighbor now sits exactly where the strip rests — swap the
      // index and reset the offset in the same un-animated frame.
      setSnap(true)
      setZoom(ZOOM_NONE)
      setStripX(0)
      onIndexChange(index + dir)
      requestAnimationFrame(() => setSnap(false))
    }, GLIDE_MS)
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (glideTimer.current) return
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    if (pts.length === 2) {
      pinch.current = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        zoom: { ...zoom },
        mx: (pts[0].x + pts[1].x) / 2,
        my: (pts[0].y + pts[1].y) / 2,
      }
      drag.current = null
    } else {
      drag.current = {
        px: e.clientX,
        py: e.clientY,
        t: Date.now(),
        moved: false,
        onImg: (e.target as HTMLElement).tagName === 'IMG',
        zoom: { ...zoom },
      }
    }
    setDragging(true)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]

    if (pts.length === 2 && pinch.current) {
      const base = pinch.current
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const s = Math.min(MAX_SCALE, Math.max(1, (base.zoom.s * dist) / base.dist))
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      const mx = (pts[0].x + pts[1].x) / 2
      const my = (pts[0].y + pts[1].y) / 2
      setZoom(
        clampPan({
          s,
          x: mx - cx - s * ((base.mx - cx - base.zoom.x) / base.zoom.s),
          y: my - cy - s * ((base.my - cy - base.zoom.y) / base.zoom.s),
        }),
      )
      return
    }

    const st = drag.current
    if (!st) return
    const dx = e.clientX - st.px
    const dy = e.clientY - st.py
    if (!st.moved && Math.hypot(dx, dy) > TAP_SLOP_PX) st.moved = true
    if (st.zoom.s > 1) {
      setZoom(clampPan({ s: st.zoom.s, x: st.zoom.x + dx, y: st.zoom.y + dy }))
      return
    }
    // Pager: follow the finger, rubber-band past the ends.
    let ox = dx
    if ((dx > 0 && !canPrev) || (dx < 0 && !canNext)) ox = dx * 0.25
    setStripX(ox)
    setFollowY(dy * 0.5)
    setDim(Math.min(0.55, (Math.abs(dy) / window.innerHeight) * 0.9))
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 1) {
      // Pinch ended with one finger still down: hand that finger a fresh
      // pan drag (at the settled zoom) so it keeps moving the photo
      // without a lift-and-retouch.
      pinch.current = null
      const rest = [...pointers.current.values()][0]
      drag.current = {
        px: rest.x,
        py: rest.y,
        t: Date.now(),
        moved: true,
        onImg: true,
        zoom: { ...zoom },
        fromPinch: true,
      }
      return
    }
    if (pointers.current.size > 0) return
    const st = drag.current
    drag.current = null
    pinch.current = null
    setDragging(false)
    if (!st || glideTimer.current) return

    // The tail of a pinch: release only, never a tap or a page turn.
    if (st.fromPinch) return

    if (!st.moved) {
      if (!st.onImg) {
        onClose() // tap on the empty backdrop
        return
      }
      const now = Date.now()
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0
        if (zoom.s > 1) {
          setZoom(ZOOM_NONE)
        } else {
          const s = DOUBLE_TAP_SCALE
          const px = st.px - window.innerWidth / 2
          const py = st.py - window.innerHeight / 2
          setZoom(clampPan({ s, x: (1 - s) * px, y: (1 - s) * py }))
        }
      } else {
        lastTap.current = now
      }
      return
    }

    if (st.zoom.s > 1) return // zoomed pan: already clamped

    const dx = e.clientX - st.px
    const dy = e.clientY - st.py
    const dt = Math.max(1, Date.now() - st.t)
    if (Math.abs(dy) > 64 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      onClose() // vertical fling dismisses
      return
    }
    const far = Math.abs(dx) > Math.max(56, window.innerWidth * 0.16)
    const flick = Math.abs(dx) / dt > 0.55
    if ((far || flick) && dx < 0 && canNext) glide(1)
    else if ((far || flick) && dx > 0 && canPrev) glide(-1)
    else {
      setStripX(0)
      setFollowY(0)
      setDim(0)
    }
  }

  const stripTransition = snap || dragging ? 'none' : `transform ${GLIDE_MS}ms cubic-bezier(0.2, 0.9, 0.3, 1)`

  return (
    <div
      className="image-viewer"
      ref={viewerRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('查看图片', 'View photo')}
      style={dim > 0 ? { background: `rgba(6, 7, 10, ${0.82 - dim * 0.5})` } : undefined}
    >
      <div
        className="viewer-strip"
        style={{ transform: `translate3d(${stripX}px, ${followY}px, 0)`, transition: stripTransition }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {[-1, 0, 1].map((k) => {
          const i = index + k
          return (
            <div className="viewer-cell" key={k} style={{ left: `${k * 100}%` }}>
              {i >= 0 && i < images.length && (
                <img
                  ref={k === 0 ? imgRef : undefined}
                  src={images[i]}
                  alt=""
                  draggable={false}
                  style={
                    k === 0
                      ? {
                          transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})`,
                          transition: dragging ? 'none' : 'transform 0.24s ease-out',
                        }
                      : undefined
                  }
                />
              )}
            </div>
          )
        })}
      </div>
      <button
        type="button"
        className="image-viewer-close"
        aria-label={t('关闭', 'Close')}
        onClick={onClose}
      >
        <ThinXIcon size={17} />
      </button>
    </div>
  )
}
