import { useCallback, useEffect, useRef, useState } from 'react'
import { isMediaPlaying, pauseCurrentMedia, registerBackgroundController } from './mediaPlayback'
import { MUSIC_TRACKS } from './musicTracks'

/** Owns the Wikimedia track and its arbitration with inline message players. */
export function useBackgroundMusic(language: string, hasIdentity: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scheduledRef = useRef(false)
  const mutedRef = useRef(true)
  const pausedByMessageRef = useRef(false)
  const lastTrackRef = useRef(-1)
  const languageRef = useRef(language)
  const [muted, setMuted] = useState(true)
  const [playing, setPlaying] = useState(false)

  useEffect(() => { languageRef.current = language }, [language])

  const pickTrack = useCallback(() => {
    const tracks = MUSIC_TRACKS[languageRef.current.startsWith('zh') ? 'zh' : 'en'] ?? MUSIC_TRACKS.en
    if (!tracks.length) return ''
    let index = Math.floor(Math.random() * tracks.length)
    if (tracks.length > 1 && index === lastTrackRef.current) index = (index + 1) % tracks.length
    lastTrackRef.current = index
    return tracks[index]
  }, [])

  const startTrack = useCallback((startMuted: boolean) => {
    const audio = audioRef.current
    if (!audio) return
    audio.src = pickTrack()
    audio.loop = false
    audio.muted = startMuted
    audio.setAttribute('playsinline', '')
    mutedRef.current = startMuted
    setMuted(startMuted)
    audio.load()
    const tryPlay = () => {
      if (isMediaPlaying()) audio.pause()
      else void audio.play().catch(() => {})
    }
    audio.addEventListener('canplay', tryPlay, { once: true })
    tryPlay()
  }, [pickTrack])

  const pauseForMessage = useCallback(() => {
    const audio = audioRef.current
    if (!mutedRef.current) pausedByMessageRef.current = true
    if (audio && !audio.paused) audio.pause()
  }, [])

  const resumeAfterMessage = useCallback(() => {
    const audio = audioRef.current
    if (!audio || mutedRef.current || !pausedByMessageRef.current) return
    pausedByMessageRef.current = false
    if (!audio.src) audio.src = pickTrack()
    void audio.play().catch(() => {})
  }, [pickTrack])

  useEffect(() => registerBackgroundController({ pause: pauseForMessage, resume: resumeAfterMessage }), [pauseForMessage, resumeAfterMessage])

  useEffect(() => {
    if (!hasIdentity || scheduledRef.current) return
    scheduledRef.current = true
    const timer = window.setTimeout(() => startTrack(true), 3000)
    return () => window.clearTimeout(timer)
  }, [hasIdentity, startTrack])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isMediaPlaying()) {
      // Selecting background music takes ownership from the active inline
      // player. The adapter records this as a non-resumable switch pause.
      pauseCurrentMedia()
      pausedByMessageRef.current = false
      if (mutedRef.current) startTrack(false)
      else {
        if (!audio.src) audio.src = pickTrack()
        audio.muted = false
        mutedRef.current = false
        setMuted(false)
        void audio.play().catch(() => {})
      }
      return
    }
    if (!mutedRef.current) {
      audio.muted = true
      mutedRef.current = true
      setMuted(true)
      audio.pause()
      pausedByMessageRef.current = false
      return
    }
    pausedByMessageRef.current = false
    startTrack(false)
  }, [pickTrack, startTrack])

  useEffect(() => {
    const retry = () => {
      if (!scheduledRef.current || isMediaPlaying()) return
      const audio = audioRef.current
      if (audio && audio.paused && !mutedRef.current) {
        audio.muted = false
        if (!audio.src) audio.src = pickTrack()
        void audio.play().catch(() => {})
      }
    }
    window.addEventListener('pointerdown', retry)
    window.addEventListener('touchstart', retry)
    return () => {
      window.removeEventListener('pointerdown', retry)
      window.removeEventListener('touchstart', retry)
    }
  }, [pickTrack])

  const ended = useCallback(() => {
    const audio = audioRef.current
    if (!audio || isMediaPlaying()) return
    audio.src = pickTrack()
    audio.muted = mutedRef.current
    void audio.play().catch(() => {})
  }, [pickTrack])

  return { audioRef, muted, playing, toggle, ended, onPlay: () => setPlaying(true), onPause: () => setPlaying(false) }
}
