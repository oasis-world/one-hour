/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useId, useRef, useState } from 'react'
import { clearPlayback, loadPlayback, mediaStarted, mediaStopped, registerMediaController, saveFoldedPlayback, savePausedPlayback, savePlayingPlayback } from '../lib/mediaPlayback'
import MediaSkeleton from './MediaSkeleton'

declare global { interface Window { SpotifyIframeApi?: any; onSpotifyIframeApiReady?: (api: any) => void } }
interface Props { uri: string; storageKey: string }
let apiPromise: Promise<any> | null = null

function loadSpotifyApi(): Promise<any> {
  if (window.SpotifyIframeApi) return Promise.resolve(window.SpotifyIframeApi)
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onSpotifyIframeApiReady
    window.onSpotifyIframeApiReady = (api) => { previous?.(api); window.SpotifyIframeApi = api; resolve(api) }
    const script = document.createElement('script')
    script.src = 'https://open.spotify.com/embed/iframe-api/v1'
    script.onerror = () => reject(new Error('Spotify iframe API failed to load'))
    document.head.appendChild(script)
  })
  return apiPromise
}

export default function SpotifyEmbed({ uri, storageKey }: Props) {
  const [ready, setReady] = useState(false)
  const id = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<any>(null)
  const savedRef = useRef(loadPlayback(storageKey))
  const timeRef = useRef(0)
  const playingRef = useRef(false)
  const foldPauseRef = useRef(false)
  const foldedPlayingRef = useRef(false)
  const switchPauseRef = useRef(false)
  const resumePendingRef = useRef(false)

  useEffect(() => {
    let disposed = false
    const unregister = registerMediaController(id, {
      pause: (reason) => {
        const wasPlaying = playingRef.current
        playingRef.current = false
        if (reason === 'fold') {
          foldedPlayingRef.current = wasPlaying
          foldPauseRef.current = true
        } else if (reason === 'switch' || reason === 'offscreen') {
          switchPauseRef.current = true
          savePausedPlayback(storageKey, timeRef.current)
        }
        if (reason === 'fold') {
          saveFoldedPlayback(storageKey, timeRef.current, wasPlaying)
        }
        controllerRef.current?.pause?.()
      },
      resumeAfterFold: () => {
        if (!foldedPlayingRef.current) return
        foldedPlayingRef.current = false
        resumePendingRef.current = true
        controllerRef.current?.resume?.()
      },
    }, containerRef.current?.closest('.msg-youtube'))
    void loadSpotifyApi().then((api) => {
      if (disposed || !containerRef.current) return
      api.createController(containerRef.current, { uri, width: '100%', height: '152' }, (controller: any) => {
        if (disposed) { controller.destroy?.(); return }
        controllerRef.current = controller
        controller.addListener('ready', () => setReady(true))
        const markPlaying = () => {
          if (foldPauseRef.current || switchPauseRef.current) return
          resumePendingRef.current = false
          playingRef.current = true
          savePlayingPlayback(storageKey, timeRef.current)
          mediaStarted(id)
        }
        controller.addListener('playback_started', () => {
          switchPauseRef.current = false
          markPlaying()
        })
        controller.addListener('playback_update', (event: any) => {
          const data = event.data
          timeRef.current = (data?.position ?? 0) / 1000
          if (data?.isPaused) {
            playingRef.current = false
            if (!foldPauseRef.current && !resumePendingRef.current) savePausedPlayback(storageKey, timeRef.current)
            foldPauseRef.current = false
            switchPauseRef.current = false
            mediaStopped(id)
          } else {
            markPlaying()
          }
        })
        const saved = savedRef.current
        if (saved?.time) controller.seek(saved.time)
        if (!saved?.pauseIntent && saved?.foldIntent === 'resume') {
          resumePendingRef.current = true
          controller.resume()
        }
        clearPlayback(storageKey)
      })
    }).catch(() => {})
    return () => {
      disposed = true
      controllerRef.current?.destroy?.()
      controllerRef.current = null
      unregister()
    }
  }, [id, storageKey, uri])

  return (
    <div className="msg-youtube msg-media-audio msg-media-spotify">
      <div className="msg-spotify-shell">
        {!ready && <MediaSkeleton />}
        <div ref={containerRef} className="msg-spotify-frame" />
      </div>
    </div>
  )
}
