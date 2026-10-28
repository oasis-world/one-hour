/**
 * Coordinates "exclusive audio": only one sound source (background music
 * or any inline message player) may be audible at a time.
 *
 * Message players register a pause callback and call `mediaStarted(id)` when
 * they begin playing; the coordinator pauses every other registered player
 * and the background music. `mediaStopped(id)` is called when a player
 * pauses/ends; the background music resumes only when nothing is playing.
 */

interface BackgroundController {
  pause: () => void
  resume: () => void
}

interface MediaController {
  pause: (reason?: 'fold' | 'switch' | 'offscreen') => void
  resumeAfterFold?: () => void
}

let backgroundController: BackgroundController | null = null
const mediaControllers = new Map<string, MediaController>()
let currentPlayingId: string | null = null
let chatIsFolding = false

export function registerBackgroundController(c: BackgroundController): () => void {
  backgroundController = c
  return () => {
    if (backgroundController === c) backgroundController = null
  }
}

export function registerMediaController(id: string, c: MediaController, visibilityTarget?: Element | null): () => void {
  mediaControllers.set(id, c)
  let observer: IntersectionObserver | null = null
  if (visibilityTarget && typeof IntersectionObserver !== 'undefined') {
    const root = visibilityTarget.closest('.chat-log')
    let hasBeenVisible = false
    observer = new IntersectionObserver(([entry]) => {
      if (!entry) return
      if (entry.isIntersecting && entry.intersectionRatio >= 0.01) {
        hasBeenVisible = true
      } else if (hasBeenVisible) {
        pauseMedia(id, 'offscreen')
      }
    }, { root, threshold: [0, 0.01] })
    observer.observe(visibilityTarget)
  }
  return () => {
    observer?.disconnect()
    mediaControllers.delete(id)
    // If the unmounting player was the active one, release exclusivity.
    if (currentPlayingId === id) {
      currentPlayingId = null
      backgroundController?.resume()
    }
  }
}

/** Pause this provider only when it currently owns playback. */
export function pauseMedia(id: string, reason: 'offscreen' | 'switch' = 'offscreen'): void {
  if (chatIsFolding && reason === 'offscreen') return
  if (currentPlayingId !== id) return
  try {
    mediaControllers.get(id)?.pause(reason)
  } catch {
    // ignore provider failures
  }
}

export function mediaStarted(id: string): void {
  if (currentPlayingId === id) return
  const previousId = currentPlayingId
  // Transfer ownership before pausing. Some providers emit PAUSED
  // synchronously, and that stale event must not resume background music.
  currentPlayingId = id
  if (previousId) {
    const prev = mediaControllers.get(previousId)
    try {
      prev?.pause('switch')
    } catch {
      // ignore
    }
  }
  backgroundController?.pause()
}

export function mediaStopped(id: string): void {
  if (currentPlayingId !== id) return
  currentPlayingId = null
  backgroundController?.resume()
}

export function isMediaPlaying(): boolean {
  return currentPlayingId !== null
}

export function pauseCurrentMedia(): void {
  const id = currentPlayingId
  if (!id) return
  const c = mediaControllers.get(id)
  // Release ownership before calling into the provider. A synchronous PAUSED
  // event must not resume background audio during an intentional takeover.
  currentPlayingId = null
  try {
    c?.pause('switch')
  } catch {
    // ignore
  }
  // Background is NOT resumed here; caller decides (e.g. start music).
}

/** Pause the active player for the fold animation without losing play intent. */
export function pauseMessageMedia(): void {
  chatIsFolding = true
  if (!currentPlayingId) return
  const id = currentPlayingId
  const c = mediaControllers.get(id)
  try {
    c?.pause('fold')
  } catch {
    // ignore provider failures
  }
  // Keep ownership until the provider reports PAUSED. This avoids briefly
  // overlapping its audio with the background track during async postMessage
  // and iframe-API pauses.
}

/** Resume only a player that was active when the chat folded. */
export function resumeMessageMedia(): void {
  chatIsFolding = false
  for (const controller of mediaControllers.values()) {
    try {
      controller.resumeAfterFold?.()
    } catch {
      // Provider may have been torn down while the chat was folded.
    }
  }
}

export function getCurrentPlayingId(): string | null {
  return currentPlayingId
}

/* ---------- Playback persistence across fold/unfold and remount ---------- */

interface SavedPlayback {
  time: number
  playing: boolean
  pauseIntent: boolean
  foldIntent: 'resume' | 'paused' | null
}

const savedPlayback = new Map<string, SavedPlayback>()

export function savePlayback(key: string, time: number, playing: boolean): void {
  const previous = savedPlayback.get(key)
  // A stale unmount snapshot must not undo a pause explicitly recorded by
  // the player. Only a subsequent PLAYING event may clear that intent.
  if (playing && previous?.pauseIntent) return
  savedPlayback.set(key, {
    time: Math.max(0, time),
    playing,
    pauseIntent: previous?.pauseIntent ?? false,
    foldIntent: previous?.foldIntent ?? null,
  })
}

export function savePausedPlayback(key: string, time: number): void {
  savedPlayback.set(key, {
    time: Math.max(0, time),
    playing: false,
    pauseIntent: true,
    foldIntent: null,
  })
}

export function savePlayingPlayback(key: string, time: number): void {
  savedPlayback.set(key, {
    time: Math.max(0, time),
    playing: true,
    pauseIntent: false,
    foldIntent: null,
  })
}

/** Record the pre-fold play state, independently from the pause command. */
export function saveFoldedPlayback(key: string, time: number, wasPlaying: boolean): void {
  const previous = savedPlayback.get(key)
  // A fold snapshot can be stale relative to a manual pause event. A later
  // explicit PLAYING event clears pauseIntent; until then it must win.
  if (previous?.pauseIntent) {
    savedPlayback.set(key, {
      time: Math.max(0, time),
      playing: false,
      pauseIntent: true,
      foldIntent: 'paused',
    })
    return
  }
  savedPlayback.set(key, {
    time: Math.max(0, time),
    playing: wasPlaying,
    pauseIntent: !wasPlaying,
    foldIntent: wasPlaying ? 'resume' : 'paused',
  })
}

export function loadPlayback(key: string): SavedPlayback | null {
  return savedPlayback.get(key) ?? null
}

export function clearPlayback(key: string): void {
  savedPlayback.delete(key)
}
