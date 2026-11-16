export const SEVEN_IMAGE = '/games/slot-machine/lucky-seven.png'
const WIN_SOUND = '/games/slot-machine/magical-coin-win.mp3'

let soundContext: AudioContext | null = null

function getSoundContext(): AudioContext | null {
  try {
    if (!soundContext || soundContext.state === 'closed') soundContext = new AudioContext()
    if (soundContext.state === 'suspended') void soundContext.resume()
    return soundContext
  } catch { return null }
}

function playTone(context: AudioContext, frequency: number, start: number, duration: number, volume: number, type: OscillatorType, endFrequency?: number) {
  try {
    const oscillator = context.createOscillator(), gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration)
    gain.gain.setValueAtTime(.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + .012)
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(start); oscillator.stop(start + duration + .02)
  } catch { /* Audio is an optional enhancement. */ }
}

export function playSpinSound() {
  const context = getSoundContext()
  if (!context) return
  const now = context.currentTime
  playTone(context, 145, now, .34, .035, 'sawtooth', 520)
  playTone(context, 270, now + .035, .25, .022, 'triangle', 710)
}

export function playReelStopSound(index: number) {
  const context = getSoundContext()
  if (!context) return
  const now = context.currentTime, frequency = 660 + index * 82
  playTone(context, frequency, now, .075, .034, 'triangle')
  playTone(context, frequency * 2.4, now, .055, .012, 'sine')
}

export function playSmallPayoutSound() {
  const context = getSoundContext()
  if (!context) return
  const now = context.currentTime
  playTone(context, 560, now, .13, .025, 'sine')
  playTone(context, 740, now + .11, .18, .025, 'sine')
}

function playWinFallback() {
  const context = getSoundContext()
  if (!context) return
  const now = context.currentTime
  ;[784, 988, 1175, 1568].forEach((frequency, index) => playTone(context, frequency, now + index * .11, .32, .05, 'sine'))
}

export function playWinSound() {
  try {
    const audio = new Audio(WIN_SOUND)
    audio.volume = .55
    void audio.play().catch(playWinFallback)
  } catch { playWinFallback() }
}
