/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useId, useRef, useState } from 'react'
import { clearPlayback, loadPlayback, mediaStarted, mediaStopped, registerMediaController, saveFoldedPlayback, savePausedPlayback, savePlayingPlayback } from '../lib/mediaPlayback'
import MediaSkeleton from './MediaSkeleton'

declare global { interface Window { Vimeo?: any } }
interface Props { id: string; storageKey: string }
let apiPromise: Promise<void> | null = null

function loadVimeoApi(): Promise<void> {
  if (window.Vimeo?.Player) return Promise.resolve()
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://player.vimeo.com/api/player.js'
    script.onload = () => resolve()
    script.onerror = () => reject()
    document.head.appendChild(script)
  })
  return apiPromise
}

export default function VimeoEmbed({ id: videoId, storageKey }: Props) {
  const [ready, setReady] = useState(false)
  const id = useId()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const playerRef = useRef<any>(null)
  const timeRef = useRef(0)
  const playingRef = useRef(false)
  const foldPauseRef = useRef(false)
  const foldedPlayingRef = useRef(false)
  const resumePendingRef = useRef(false)
  const savedRef = useRef(loadPlayback(storageKey))

  useEffect(() => {
    let disposed = false
    const unregister = registerMediaController(id, {
      pause: (reason) => {
        const wasPlaying = playingRef.current
        playingRef.current = false
        if (reason === 'fold') {
          foldedPlayingRef.current = wasPlaying
          foldPauseRef.current = true
          saveFoldedPlayback(storageKey, timeRef.current, wasPlaying)
        } else {
          savePausedPlayback(storageKey, timeRef.current)
        }
        void playerRef.current?.pause?.()
      },
      resumeAfterFold: () => {
        if (!foldedPlayingRef.current) return
        foldedPlayingRef.current = false
        resumePendingRef.current = true
        void playerRef.current?.play?.().catch(() => { resumePendingRef.current = false })
      },
    }, frameRef.current?.closest('.msg-youtube'))
    void loadVimeoApi().then(() => {
      if (disposed || !frameRef.current || !window.Vimeo?.Player) return
      const player = new window.Vimeo.Player(frameRef.current)
      playerRef.current = player
      player.on('play', () => { resumePendingRef.current = false; playingRef.current = true; savePlayingPlayback(storageKey, timeRef.current); mediaStarted(id) })
      player.on('pause', () => {
        playingRef.current = false
        if (!foldPauseRef.current && !resumePendingRef.current) savePausedPlayback(storageKey, timeRef.current)
        foldPauseRef.current = false
        mediaStopped(id)
      })
      player.on('timeupdate', (event: { seconds: number }) => {
        timeRef.current = event.seconds
        if (playingRef.current) savePlayingPlayback(storageKey, event.seconds)
      })
      player.on('ended', () => { clearPlayback(storageKey); mediaStopped(id) })
      void player.ready().then(() => {
        if (disposed) return
        setReady(true)
        const saved = savedRef.current
        const seek = saved?.time ? player.setCurrentTime(saved.time) : Promise.resolve()
        void seek.then(() => {
          if (!saved?.pauseIntent && saved?.foldIntent === 'resume') {
            resumePendingRef.current = true
            return player.play()
          }
          return undefined
        }).catch(() => {})
        clearPlayback(storageKey)
      }).catch(() => {})
    }).catch(() => {})
    return () => {
      disposed = true
      void playerRef.current?.destroy?.()
      playerRef.current = null
      unregister()
    }
  }, [id, storageKey])

  return (
    <div className="msg-youtube">
      <div className="msg-youtube-frame">
        {!ready && <MediaSkeleton />}
        <iframe ref={frameRef} src={`https://player.vimeo.com/video/${videoId}?dnt=1&api=1`} title="Vimeo video" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
      </div>
    </div>
  )
}
