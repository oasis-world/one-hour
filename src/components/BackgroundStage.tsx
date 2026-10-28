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

  const cornerLink = isChat ? null : (cloudPhoto?.source ?? null)

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