import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchRandomBackground, type BackgroundPhoto } from '../lib/backgroundFeed'
import { loadBgTtlMs } from '../lib/settings'
import BgSlotRing from './BgSlotRing'

const ROTATE_CHECK_MS = 10_000
const BG_STATE_KEY = 'one-hour-bg-state'

interface BgState {
  type: 'chat' | 'cloud'
  url: string
  since: number
  index: number
}

export default function BackgroundStage({
  imageUrls,
  revealed,
  onReady,
}: {
  imageUrls: string[]
  revealed: boolean
  onReady?: () => void
}) {
  const [live, setLive] = useState<string | null>(null)
  const [isChat, setIsChat] = useState(false)
  const [cloudPhoto, setCloudPhoto] = useState<BackgroundPhoto | null>(null)
  const [slotSince, setSlotSince] = useState(0)

  const imageUrlsRef = useRef(imageUrls)
  useEffect(() => {
    imageUrlsRef.current = imageUrls
  }, [imageUrls])
  const liveRef = useRef(live)
  useEffect(() => {
    liveRef.current = live
  }, [live])
  const isChatRef = useRef(isChat)
  useEffect(() => {
    isChatRef.current = isChat
  }, [isChat])
  const slotSinceRef = useRef(slotSince)
  useEffect(() => {
    slotSinceRef.current = slotSince
  }, [slotSince])

  const indexRef = useRef(0)
  const rotatingRef = useRef(false)
  const readyFiredRef = useRef(false)
  const initializedRef = useRef(false)
  const cloudTimerRef = useRef<number | null>(null)
  const pendingPersistedChatRef = useRef<{ url: string; since: number } | null>(null)

  const persist = useCallback((state: BgState) => {
    try {
      localStorage.setItem(BG_STATE_KEY, JSON.stringify(state))
    } catch {
      // Private mode: in-memory only.
    }
  }, [])

  const showChatAt = useCallback(
    (index: number) => {
      const urls = imageUrlsRef.current
      if (index < 0 || index >= urls.length) return false
      const url = urls[index]
      indexRef.current = index
      setIsChat(true)
      setLive(url)
      const now = Date.now()
      setSlotSince(now)
      persist({ type: 'chat', url, since: now, index })
      return true
    },
    [persist],
  )

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
      setIsChat(false)
      setLive(photo.url)
      const now = Date.now()
      setSlotSince(now)
      persist({ type: 'cloud', url: photo.url, since: now, index: -1 })
    } finally {
      rotatingRef.current = false
    }
  }, [persist])

  const scheduleCloud = useCallback(() => {
    if (cloudTimerRef.current) return
    cloudTimerRef.current = window.setTimeout(() => {
      cloudTimerRef.current = null
      void showCloud()
    }, 10000)
  }, [showCloud])

  const cancelCloud = useCallback(() => {
    if (cloudTimerRef.current) {
      window.clearTimeout(cloudTimerRef.current)
      cloudTimerRef.current = null
    }
  }, [])

  // Initial selection: resume a persisted chat photo if it is still live,
  // otherwise start at the first chat photo, or fetch a cloud photo.
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    const persisted: BgState | null = (() => {
      try {
        return JSON.parse(localStorage.getItem(BG_STATE_KEY) || 'null') as BgState | null
      } catch {
        return null
      }
    })()
    const urls = imageUrlsRef.current
    if (persisted?.type === 'chat') {
      // Remember it; resume (without resetting the timer) once the chat
      // image list has loaded.
      pendingPersistedChatRef.current = {
        url: persisted.url,
        since: persisted.since || Date.now(),
      }
      if (urls.includes(persisted.url)) {
        const idx = urls.indexOf(persisted.url)
        indexRef.current = idx
        setIsChat(true)
        setLive(persisted.url)
        setSlotSince(persisted.since || Date.now())
        pendingPersistedChatRef.current = null
      } else if (urls.length > 0) {
        showChatAt(0)
      } else {
        scheduleCloud()
      }
    } else if (urls.length > 0) {
      showChatAt(0)
    } else {
      // No chat images: fetch a cloud photo now.
      void showCloud()
    }
  }, [scheduleCloud, showChatAt, showCloud])

  // React to the chat image list changing (new photo / expiry).
  useEffect(() => {
    if (!initializedRef.current) return
    imageUrlsRef.current = imageUrls
    if (imageUrls.length === 0) {
      if (isChatRef.current) {
        // All chat photos gone: fall back to cloud.
        void showCloud()
      }
      // Cloud is already on screen: leave it until its slot expires.
      return
    }
    const pending = pendingPersistedChatRef.current
    if (pending && imageUrls.includes(pending.url)) {
      pendingPersistedChatRef.current = null
      const idx = imageUrls.indexOf(pending.url)
      indexRef.current = idx
      setIsChat(true)
      setLive(pending.url)
      setSlotSince(pending.since)
      return
    }
    const current = liveRef.current
    if (isChatRef.current && current && imageUrls.includes(current)) {
      indexRef.current = imageUrls.indexOf(current)
      return
    }
    // Chat photos available (or current gone): chat wins.
    showChatAt(0)
  }, [cancelCloud, imageUrls, scheduleCloud, showChatAt, showCloud])

  // Slot timer: advance chat photos hourly, refresh cloud photos hourly.
  useEffect(() => {
    if (!live) return
    const check = () => {
      if (rotatingRef.current) return
      const ttl = loadBgTtlMs()
      const elapsed = Date.now() - slotSinceRef.current
      if (elapsed < ttl) return
      if (isChatRef.current) {
        const next = indexRef.current + 1
        const urls = imageUrlsRef.current
        if (next < urls.length) {
          showChatAt(next)
        } else {
          void showCloud()
        }
      } else {
        void showCloud()
      }
    }
    check()
    const timer = setInterval(check, ROTATE_CHECK_MS)
    return () => clearInterval(timer)
  }, [live, showChatAt, showCloud])

  // Splash promotion.
  useEffect(() => {
    if (live && !readyFiredRef.current) {
      readyFiredRef.current = true
      onReady?.()
    }
  }, [live, onReady])

  useEffect(() => () => cancelCloud(), [cancelCloud])

  // Crossfade layers.
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