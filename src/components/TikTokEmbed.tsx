import { useEffect, useId, useRef, useState } from 'react'
import { clearPlayback, loadPlayback, mediaStarted, mediaStopped, registerMediaController, saveFoldedPlayback, savePausedPlayback, savePlayingPlayback } from '../lib/mediaPlayback'
import MediaSkeleton from './MediaSkeleton'

interface Props { id: string; storageKey: string }
type TikTokMessage = { 'x-tiktok-player'?: boolean; type?: string; value?: number | { currentTime?: number } }

export default function TikTokEmbed({ id: videoId, storageKey }: Props) {
  const [ready, setReady] = useState(false)
  const instanceId = useId()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const timeRef = useRef(0)
  const savedRef = useRef(loadPlayback(storageKey))
  const playingRef = useRef(false)
  const foldPauseRef = useRef(false)
  const foldedPlayingRef = useRef(false)
  const resumePendingRef = useRef(false)
  const send = (type: string, value?: number) => {
    frameRef.current?.contentWindow?.postMessage({ 'x-tiktok-player': true, type, ...(value === undefined ? {} : { value }) }, 'https://www.tiktok.com')
  }

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const unregister = registerMediaController(instanceId, {
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
        send('pause')
      },
      resumeAfterFold: () => {
        if (!foldedPlayingRef.current) return
        foldedPlayingRef.current = false
        resumePendingRef.current = true
        send('play')
      },
    }, frame.closest('.msg-youtube'))
    const onMessage = (event: MessageEvent<TikTokMessage>) => {
      if (event.source !== frame.contentWindow || event.origin !== 'https://www.tiktok.com') return
      const message = event.data
      if (!message || message['x-tiktok-player'] !== true) return
      if (message.type === 'onPlayerReady') {
        setReady(true)
        const saved = savedRef.current
        if (saved && saved.time > 0) send('seekTo', saved.time)
        if (!saved?.pauseIntent && saved?.foldIntent === 'resume') {
          resumePendingRef.current = true
          send('play')
        }
        clearPlayback(storageKey)
      }
      if (message.type === 'onCurrentTime') {
        const value = typeof message.value === 'object' ? message.value.currentTime : message.value
        if (typeof value === 'number') timeRef.current = value
      }
      if (message.type === 'onStateChange') {
        if (message.value === 1) {
          if (foldPauseRef.current) return
          resumePendingRef.current = false
          playingRef.current = true
          savePlayingPlayback(storageKey, timeRef.current)
          mediaStarted(instanceId)
        } else if (message.value === 2) {
          playingRef.current = false
          if (!foldPauseRef.current && !resumePendingRef.current) savePausedPlayback(storageKey, timeRef.current)
          foldPauseRef.current = false
          mediaStopped(instanceId)
        } else if (message.value === 0) {
          clearPlayback(storageKey)
          mediaStopped(instanceId)
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      unregister()
    }
  }, [instanceId, storageKey])

  return (
    <div className="msg-youtube">
      <div className="msg-youtube-frame">
        {!ready && <MediaSkeleton />}
        <iframe ref={frameRef} src={`https://www.tiktok.com/player/v1/${videoId}`} title="TikTok video" loading="lazy" allow="fullscreen" />
      </div>
    </div>
  )
}
