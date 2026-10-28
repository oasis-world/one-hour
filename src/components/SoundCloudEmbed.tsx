/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useId, useRef, useState } from 'react'
import { clearPlayback, loadPlayback, mediaStarted, mediaStopped, registerMediaController, saveFoldedPlayback, savePausedPlayback, savePlayingPlayback } from '../lib/mediaPlayback'
import MediaSkeleton from './MediaSkeleton'

declare global { interface Window { SC?: any } }
interface Props { src: string; storageKey: string }

function loadWidgetApi(): Promise<void> {
  if (window.SC?.Widget) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-soundcloud-widget]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://w.soundcloud.com/player/api.js'
    script.dataset.soundcloudWidget = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject()
    document.head.appendChild(script)
  })
}

export default function SoundCloudEmbed({ src, storageKey }: Props) {
  const [ready, setReady] = useState(false)
  const id = useId()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const widgetRef = useRef<any>(null)
  const timeRef = useRef(0)
  const playingRef = useRef(false)
  const savedRef = useRef(loadPlayback(storageKey))
  const foldPauseRef = useRef(false)
  const foldedPlayingRef = useRef(false)
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
          saveFoldedPlayback(storageKey, timeRef.current / 1000, wasPlaying)
        } else {
          savePausedPlayback(storageKey, timeRef.current / 1000)
        }
        widgetRef.current?.pause()
      },
      resumeAfterFold: () => {
        if (!foldedPlayingRef.current) return
        foldedPlayingRef.current = false
        resumePendingRef.current = true
        widgetRef.current?.play()
      },
    }, frameRef.current?.closest('.msg-youtube'))
    void loadWidgetApi().then(() => {
      const frame = frameRef.current
      if (disposed || !frame || !window.SC?.Widget) return
      const widget = window.SC.Widget(frame)
      widgetRef.current = widget
      const events = window.SC.Widget.Events
      widget.bind(events.READY, () => {
        setReady(true)
        const saved = savedRef.current
        if (saved?.time) widget.seekTo(saved.time * 1000)
        if (!saved?.pauseIntent && saved?.foldIntent === 'resume') {
          resumePendingRef.current = true
          widget.play()
        }
        clearPlayback(storageKey)
      })
      widget.bind(events.PLAY, () => {
        resumePendingRef.current = false
        playingRef.current = true
        savePlayingPlayback(storageKey, timeRef.current / 1000)
        mediaStarted(id)
      })
      widget.bind(events.PAUSE, () => {
        playingRef.current = false
        if (!foldPauseRef.current && !resumePendingRef.current) savePausedPlayback(storageKey, timeRef.current / 1000)
        foldPauseRef.current = false
        mediaStopped(id)
      })
      widget.bind(events.PLAY_PROGRESS, (event: { currentPosition: number }) => {
        timeRef.current = event.currentPosition
        if (playingRef.current) savePlayingPlayback(storageKey, event.currentPosition / 1000)
      })
      widget.bind(events.FINISH, () => { clearPlayback(storageKey); mediaStopped(id) })
    }).catch(() => {})
    return () => {
      disposed = true
      widgetRef.current = null
      unregister()
    }
  }, [id, storageKey])

  return (
    <div className="msg-youtube">
      <div className="msg-audio-frame">
        {!ready && <MediaSkeleton />}
        <iframe ref={frameRef} src={src} title="SoundCloud player" loading="lazy" allow="autoplay" />
      </div>
    </div>
  )
}
