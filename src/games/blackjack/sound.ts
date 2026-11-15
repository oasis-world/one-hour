let context: AudioContext | null = null
const enabled = new Set<string>()

function audioContext() {
  try {
    if (!context || context.state === 'closed') context = new AudioContext()
    if (context.state === 'suspended') void context.resume()
    return context
  } catch { return null }
}

function tone(frequency: number, duration: number, volume: number, type: OscillatorType, delay = 0) {
  const audio = audioContext()
  if (!audio) return
  try {
    const start = audio.currentTime + delay
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    gain.gain.setValueAtTime(.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + .035)
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration)
    oscillator.connect(gain).connect(audio.destination)
    oscillator.start(start)
    oscillator.stop(start + duration + .04)
  } catch { /* Audio is an optional enhancement. */ }
}

export function setBlackjackSound(instanceId: string, on: boolean) {
  if (on) {
    enabled.add(instanceId)
    audioContext()
  } else enabled.delete(instanceId)
}

export function stopBlackjackSound(instanceId: string) {
  enabled.delete(instanceId)
}

export function blackjackSound(instanceId: string, event: 'deal' | 'chip' | 'win' | 'lose') {
  if (!enabled.has(instanceId)) return
  if (event === 'deal') {
    tone(420, .11, .035, 'triangle')
    tone(630, .08, .012, 'sine', .045)
  } else if (event === 'chip') {
    tone(770, .045, .025, 'triangle')
    tone(1120, .055, .012, 'sine', .035)
  } else if (event === 'win') {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((note, index) => tone(note, .42, .04, 'sine', index * .105))
  } else {
    tone(220, .22, .028, 'triangle')
    tone(164.81, .3, .018, 'sine', .14)
  }
}
