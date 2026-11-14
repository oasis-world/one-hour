let audioContext: AudioContext | null = null
let silentAudio: HTMLAudioElement | null = null
const soundEnabledInstances = new Set<string>()

function getAudioContext(): AudioContext | null {
  try {
    if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContext()
    if (audioContext.state === 'suspended') void audioContext.resume()
    return audioContext
  } catch {
    return null
  }
}

function isIOSWebKit() {
  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && 'webkitAudioContext' in window
}

// A silent media track is a best-effort iOS WebKit workaround: starting it
// from the sound-toggle gesture can let Web Audio share the playback session
// even when the hardware silent switch is on. Web pages cannot override that
// switch reliably on every iOS version.
// WAV framing adapted from Feross Aboukhadijeh's MIT-licensed unmute-ios-audio.
function createSilentAudioUrl(sampleRate: number) {
  const buffer = new ArrayBuffer(10)
  const view = new DataView(buffer)
  view.setUint32(0, sampleRate, true)
  view.setUint32(4, sampleRate, true)
  view.setUint16(8, 1, true)
  const bytes = Array.from(new Uint8Array(buffer), (byte) => String.fromCharCode(byte)).join('')
  const partialHeader = btoa(bytes).slice(0, 13)
  return `data:audio/wav;base64,UklGRisAAABXQVZFZm10IBAAAAABAAEA${partialHeader}AgAZGF0YQcAAACAgICAgICAAAA=`
}

export function setMatch3SoundEnabled(instanceId: string, enabled: boolean) {
  if (!enabled) {
    soundEnabledInstances.delete(instanceId)
    if (soundEnabledInstances.size === 0) silentAudio?.pause()
    return
  }

  soundEnabledInstances.add(instanceId)
  const context = getAudioContext()
  if (context) {
    try {
      const source = context.createBufferSource()
      source.buffer = context.createBuffer(1, 1, context.sampleRate)
      source.connect(context.destination)
      source.start()
    } catch { /* The next game sound will retry audio playback. */ }
  }

  if (isIOSWebKit()) {
    try {
      if (!silentAudio) {
        silentAudio = new Audio(createSilentAudioUrl(context?.sampleRate ?? 44100))
        silentAudio.loop = true
        silentAudio.preload = 'auto'
        silentAudio.setAttribute('x-webkit-airplay', 'deny')
      }
      void silentAudio.play().catch(() => { /* iOS policy differs by version. */ })
    } catch { /* Audio remains an optional enhancement. */ }
  }
}

function playTone(
  enabled: boolean,
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
  startDelay = 0,
) {
  if (!enabled) return
  const context = getAudioContext()
  if (!context) return
  try {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const start = context.currentTime + startDelay
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
  } catch {
    // Sound is optional; gameplay should never depend on audio support.
  }
}

export function playSwapSound(enabled: boolean) {
  playTone(enabled, 520, 0.08, 0.06, 'triangle')
  playTone(enabled, 780, 0.06, 0.04, 'sine', 0.04)
}

export function playInvalidSound(enabled: boolean) {
  playTone(enabled, 220, 0.12, 0.07, 'sawtooth')
  playTone(enabled, 180, 0.1, 0.05, 'sawtooth', 0.06)
}

export function playScoreSound(combo: number, enabled: boolean) {
  const melody = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 1318.51, 1046.5]
  const pitch = 2 ** (Math.min(combo - 1, 5) / 12)
  melody.forEach((note, index) => {
    const accent = index === 4 || index === 5 || index === melody.length - 1
    playTone(
      enabled,
      note * pitch,
      accent ? 0.42 : 0.3,
      accent ? 0.05 : 0.038,
      accent ? 'triangle' : 'sine',
      index * 0.18,
    )
  })
  const harmony = [261.63, 392, 523.25, 392]
  harmony.forEach((note, index) => {
    playTone(enabled, note * pitch, 0.58, 0.016, 'sine', index * 0.46)
  })
  const sparkles = [1567.98, 2093, 1760]
  sparkles.forEach((note, index) => {
    playTone(enabled, note * pitch, 0.2, 0.016, 'triangle', 0.3 + index * 0.5)
  })
}

export function playCascadeSound(combo: number, enabled: boolean) {
  playTone(enabled, 440 + combo * 80, 0.15, 0.08, 'sine')
  playTone(enabled, 660 + combo * 120, 0.18, 0.07, 'triangle', 0.08)
}

export function playSelectSound(enabled: boolean) {
  playTone(enabled, 380, 0.05, 0.04, 'sine')
}
