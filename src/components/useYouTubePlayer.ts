/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useId, useRef } from 'react'
import {
  clearPlayback,
  loadPlayback,
  mediaStarted,
  mediaStopped,
  registerMediaController,
  savePausedPlayback,
  saveFoldedPlayback,
  savePlayback,
  savePlayingPlayback,
} from '../lib/mediaPlayback'

declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
    __ytApiPromise?: Promise<any>
  }
}

function getYT(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!window.__ytApiPromise) {
    window.__ytApiPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        previous?.()
        resolve(window.YT)
      }
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement('script')
        script.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(script)
      }
    })
  }
  return window.__ytApiPromise
}

export function useYouTubePlayer(videoId: string, storageKey?: string) {
  const instanceId = useId()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerRef = useRef<any>(null)
  const isPlayingRef = useRef(false)
  const pauseRequestedRef = useRef(false)
  const playAfterPauseRef = useRef(false)
  const foldPauseRef = useRef(false)
  const foldedPlayingRef = useRef(false)
  const resumePendingRef = useRef(false)
  const hasPlayedRef = useRef(false)
  const savedRef = useRef(storageKey ? loadPlayback(storageKey) : null)

  useEffect(() => {
    let destroyed = false
    const unregister = registerMediaController(instanceId, {
      pause: (reason) => {
        try {
          if (storageKey && playerRef.current) {
            const time = playerRef.current.getCurrentTime?.() ?? 0
            if (reason === 'fold') {
              foldedPlayingRef.current = isPlayingRef.current
              foldPauseRef.current = true
              saveFoldedPlayback(storageKey, time, isPlayingRef.current)
            } else {
              savePausedPlayback(storageKey, time)
            }
          }
          pauseRequestedRef.current = true
          playerRef.current?.pauseVideo?.()
        } catch {
          // Provider may be tearing down.
        }
      },
      resumeAfterFold: () => {
        if (!foldedPlayingRef.current) return
        foldedPlayingRef.current = false
        resumePendingRef.current = true
        pauseRequestedRef.current = false
        playerRef.current?.playVideo?.()
      },
    }, iframeRef.current?.closest('.msg-youtube'))

    void getYT().then((YT) => {
      if (destroyed || !iframeRef.current) return
      const player = new YT.Player(iframeRef.current, {
        events: {
          onReady: () => {
            const saved = savedRef.current
            if (!saved) return
            try {
              if (saved.pauseIntent || saved.foldIntent === 'paused') {
                player.cueVideoById({ videoId, startSeconds: saved.time })
                return
              } else if (saved.playing || saved.foldIntent === 'resume') {
                resumePendingRef.current = true
                player.seekTo(saved.time, true)
                player.playVideo()
                return
              } else {
                player.seekTo(saved.time, true)
              }
            } catch {
              // Ignore restore failures; the provider player still works.
            }
            if (storageKey) clearPlayback(storageKey)
            savedRef.current = null
          },
          onStateChange: (event: any) => {
            if (event.data === 1) {
              if (pauseRequestedRef.current) {
                // A user can hit Play before an asynchronous switch-pause is
                // acknowledged. Replay after that stale PAUSED event lands.
                playAfterPauseRef.current = true
                return
              }
              if (savedRef.current?.pauseIntent || savedRef.current?.foldIntent === 'paused') {
                pauseRequestedRef.current = true
                playerRef.current?.pauseVideo?.()
                return
              }
              resumePendingRef.current = false
              hasPlayedRef.current = true
              if (storageKey) {
                savePlayingPlayback(storageKey, playerRef.current?.getCurrentTime?.() ?? 0)
              }
              savedRef.current = null
              if (!isPlayingRef.current) {
                isPlayingRef.current = true
                mediaStarted(instanceId)
              }
            } else if (event.data === 2) {
              pauseRequestedRef.current = false
              if (isPlayingRef.current) {
                isPlayingRef.current = false
                mediaStopped(instanceId)
              }
              if (
                storageKey &&
                !foldPauseRef.current &&
                !resumePendingRef.current &&
                savedRef.current?.foldIntent !== 'resume'
              ) {
                savePausedPlayback(storageKey, playerRef.current?.getCurrentTime?.() ?? 0)
              }
              if (savedRef.current?.pauseIntent && storageKey) {
                clearPlayback(storageKey)
                savedRef.current = null
              }
              foldPauseRef.current = false
              if (playAfterPauseRef.current) {
                playAfterPauseRef.current = false
                resumePendingRef.current = true
                playerRef.current?.playVideo?.()
              }
            } else if (event.data === 5 && savedRef.current?.pauseIntent) {
              if (storageKey) clearPlayback(storageKey)
              savedRef.current = null
            } else if (event.data === 0) {
              if (isPlayingRef.current) {
                isPlayingRef.current = false
                mediaStopped(instanceId)
              }
              if (storageKey) clearPlayback(storageKey)
              savedRef.current = null
            }
          },
        },
      })
      playerRef.current = player
    }).catch(() => {})

    return () => {
      destroyed = true
      if (storageKey && playerRef.current) {
        try {
          const time = playerRef.current.getCurrentTime?.() ?? 0
          const state = playerRef.current.getPlayerState?.()
          const playing = isPlayingRef.current && state !== 2 && state !== 0
          if (playing || hasPlayedRef.current || time > 0.5) savePlayback(storageKey, time, playing)
          else if (loadPlayback(storageKey)) clearPlayback(storageKey)
        } catch {
          // Ignore teardown snapshots from a failed provider instance.
        }
      }
      try { playerRef.current?.destroy?.() } catch { /* ignore */ }
      playerRef.current = null
      if (isPlayingRef.current) {
        isPlayingRef.current = false
        mediaStopped(instanceId)
      }
      unregister()
    }
  }, [instanceId, storageKey, videoId])

  return iframeRef
}
