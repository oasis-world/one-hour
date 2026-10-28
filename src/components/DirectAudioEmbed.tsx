import { useEffect, useId, useRef, useState } from 'react'
import { clearPlayback, loadPlayback, mediaStarted, mediaStopped, registerMediaController, saveFoldedPlayback, savePausedPlayback, savePlayingPlayback } from '../lib/mediaPlayback'
import MediaSkeleton from './MediaSkeleton'

interface Props { src: string; title: string; storageKey: string }

export default function DirectAudioEmbed({ src, title, storageKey }: Props) {
  const [ready, setReady] = useState(false)
  const id = useId()
  const audioRef = useRef<HTMLAudioElement>(null)
  const foldPauseRef = useRef(false)
  const foldedPlayingRef = useRef(false)
  const resumePendingRef = useRef(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const saved = loadPlayback(storageKey)
    const restorePosition = () => {
      if (!saved || !Number.isFinite(saved.time)) return
      audio.currentTime = saved.time
      if (!saved.pauseIntent && saved.foldIntent === 'resume') {
        resumePendingRef.current = true
        void audio.play().catch(() => { resumePendingRef.current = false })
      }
    }
    if (audio.readyState >= 1) restorePosition()
    else audio.addEventListener('loadedmetadata', restorePosition, { once: true })
    const unregister = registerMediaController(id, {
      pause: (reason) => {
        if (reason === 'fold') {
          foldedPlayingRef.current = !audio.paused
          foldPauseRef.current = true
          saveFoldedPlayback(storageKey, audio.currentTime, !audio.paused)
        } else {
          savePausedPlayback(storageKey, audio.currentTime)
        }
        audio.pause()
      },
      resumeAfterFold: () => {
        if (!foldedPlayingRef.current) return
        foldedPlayingRef.current = false
        resumePendingRef.current = true
        void audio.play().catch(() => { resumePendingRef.current = false })
      },
    }, audio.closest('.msg-youtube'))
    return () => {
      audio.removeEventListener('loadedmetadata', restorePosition)
      if (!audio.paused) savePausedPlayback(storageKey, audio.currentTime)
      unregister()
    }
  }, [id, storageKey])

  return (
    <div className="msg-youtube msg-media-audio">
      {!ready && <MediaSkeleton />}
      <audio
        ref={audioRef}
        controls
        preload="metadata"
        onLoadedMetadata={() => setReady(true)}
        onError={() => setReady(true)}
        src={src}
        aria-label={title}
        onPlay={(event) => {
          resumePendingRef.current = false
          savePlayingPlayback(storageKey, event.currentTarget.currentTime)
          mediaStarted(id)
        }}
        onPause={(event) => {
          if (!foldPauseRef.current && !resumePendingRef.current) savePausedPlayback(storageKey, event.currentTarget.currentTime)
          foldPauseRef.current = false
          mediaStopped(id)
        }}
        onEnded={() => { clearPlayback(storageKey); mediaStopped(id) }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget
          if (!audio.paused) savePlayingPlayback(storageKey, audio.currentTime)
        }}
      />
    </div>
  )
}
