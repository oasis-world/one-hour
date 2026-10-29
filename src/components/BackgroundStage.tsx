import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchRandomBackground, type BackgroundPhoto } from '../lib/backgroundFeed'
import { loadBgTtlMs } from '../lib/settings'
import BgSlotRing from './BgSlotRing'

const ROTATE_CHECK_MS = 10_000
const BG_STATE_KEY = 'one-hour-bg-state'

interface BgState {
  type: 'cloud'
  url: string
  since: number
}

export interface ChatBackgroundImage {
  url: string
  since: number
}

export default function BackgroundStage({
  chatImage,
  revealed,
  onReady,
}: {
  chatImage: ChatBackgroundImage | null
  revealed: boolean
  onReady?: () => void
}) {
  // Never restore a blob: URL from a previous session — object URLs do not
  // survive a reload, so a persisted value would paint a broken image.
  // Always start empty and fetch a fresh cloud photo when needed.
  const [cloudLive, setCloudLive] = useState<string | null>(null)
  const [edgeColors, setEdgeColors] = useState<{ left: string; right: string } | null>(null)
  const [cloudPhoto, setCloudPhoto] = useState<BackgroundPhoto | null>(null)
  const [cloudSlotSince, setCloudSlotSince] = useState<number>(0)

  // Chat photos are derived directly from the (globally synchronized) prop,
  // so every client shows the same photo with the same countdown. Only cloud
  // photos keep their own (local) state.
  const isChat = !!chatImage
  const live = chatImage ? chatImage.url : cloudLive
  const slotSince = chatImage ? chatImage.since : cloudSlotSince

  const cloudLiveRef = useRef(cloudLive)
  useEffect(() => {
    cloudLiveRef.current = cloudLive
  }, [cloudLive])
  const slotSinceRef = useRef(slotSince)
  useEffect(() => {
    slotSinceRef.current = slotSince
  }, [slotSince])

  const rotatingRef = useRef(false)
  const readyFiredRef = useRef(false)
  const initializedRef = useRef(false)
  const cloudTimerRef = useRef<number | null>(null)

  const persistCloud = useCallback((url: string, since: number) => {
    try {
      localStorage.setItem(BG_STATE_KEY, JSON.stringify({ type: 'cloud', url, since } as BgState))
    } catch {
      // Private mode: in-memory only.
    }
  }, [])

  const showCloud = useCallback(async () => {
    if (rotatingRef.current) return
    rotatingRef.current = true
    try {
      const photo = await fetchRandomBackground()
      if (!photo) return
      setCloudPhoto((prev) => {
        if (prev?.url.startsWith('blob:')) URL.revokeObjectURL(prev.url)
        return photo
      })
      setCloudLive(photo.url)
      const now = Date.now()
      setCloudSlotSince(now)
      persistCloud(photo.url, now)
    } finally {
      rotatingRef.current = false
    }
  }, [persistCloud])

  const cancelCloud = useCallback(() => {
    if (cloudTimerRef.current) {
      window.clearTimeout(cloudTimerRef.current)
      cloudTimerRef.current = null
    }
  }, [])

  // Initial selection.
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    if (chatImage) return
    if (!cloudLive) {
      void showCloud()
    }
  }, [chatImage, cloudLive, showCloud])

  // If chat photos disappear, make sure a cloud photo is loaded.
  useEffect(() => {
    if (chatImage) return
    if (cloudLive) return
    void showCloud()
  }, [chatImage, cloudLive, showCloud])

  // Slot timer: only cloud photos auto-advance.
  useEffect(() => {
    if (!live || isChat) return
    const check = () => {
      if (rotatingRef.current) return
      const ttl = loadBgTtlMs()
      const elapsed = Date.now() - slotSinceRef.current
      if (elapsed < ttl) return
      void showCloud()
    }
    check()
    const timer = setInterval(check, ROTATE_CHECK_MS)
    return () => clearInterval(timer)
  }, [live, isChat, showCloud])

  useEffect(() => {
    if (live && !readyFiredRef.current) {
      readyFiredRef.current = true
      onReady?.()
    }
  }, [live, onReady])

  useEffect(() => () => cancelCloud(), [cancelCloud])

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
  useEffect(() => {
    if (layers.length <= 1) return
    const timer = setTimeout(() => {
      setLayers((prev) => prev.slice(-1))
    }, 1400)
    return () => clearTimeout(timer)
  }, [layers])

  // Sample the left/right edge colours of the current photo so the blurred
  // backdrop (shown in contain mode) stays close to the image.
  useEffect(() => {
    if (!live) {
      const timer = window.setTimeout(() => setEdgeColors(null), 0)
      return () => window.clearTimeout(timer)
    }
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      try {
        const w = img.naturalWidth || img.width
        const h = img.naturalHeight || img.height
        if (!w || !h) return
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, w, h)
        const sample = (x: number) => {
          const col = ctx.getImageData(Math.max(0, Math.min(w - 1, x)), 0, 1, h).data
          let r = 0, g = 0, b = 0, n = 0
          for (let i = 0; i < col.length; i += 4) {
            r += col[i]; g += col[i + 1]; b += col[i + 2]; n++
          }
          if (!n) return 'rgb(20,22,30)'
          return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`
        }
        const left = sample(0)
        const right = sample(w - 1)
        if (!cancelled) setEdgeColors({ left, right })
      } catch {
        if (!cancelled) setEdgeColors(null)
      }
    }
    img.onerror = () => { if (!cancelled) setEdgeColors(null) }
    img.src = live
    return () => { cancelled = true }
  }, [live])

  const cornerLink = isChat ? null : (cloudPhoto?.source ?? null)

  return (
    <div className="bg-stage" aria-hidden="true">
      {edgeColors && (
        <div
          className="bg-edge"
          style={{ background: `linear-gradient(90deg, ${edgeColors.left}, ${edgeColors.right})` }}
        />
      )}
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