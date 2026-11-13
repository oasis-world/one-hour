let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContext()
    if (audioContext.state === 'suspended') void audioContext.resume()
    return audioContext
  } catch {
    return null
  }
}

function playTone(
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
  startDelay = 0,
) {
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

export function playSwapSound() {
  playTone(520, 0.08, 0.06, 'triangle')
  playTone(780, 0.06, 0.04, 'sine', 0.04)
}

export function playInvalidSound() {
  playTone(220, 0.12, 0.07, 'sawtooth')
  playTone(180, 0.1, 0.05, 'sawtooth', 0.06)
}

export function playClearSound(combo: number) {
  playTone(660 + combo * 60, 0.1, 0.07, 'sine')
  playTone(990 + combo * 90, 0.12, 0.06, 'triangle', 0.05)
}

export function playCascadeSound(combo: number) {
  playTone(440 + combo * 80, 0.15, 0.08, 'sine')
  playTone(660 + combo * 120, 0.18, 0.07, 'triangle', 0.08)
}

export function playSelectSound() {
  playTone(380, 0.05, 0.04, 'sine')
}
