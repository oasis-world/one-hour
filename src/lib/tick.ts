/**
 * One shared per-second ticker for every on-screen clock (message
 * countdowns, the backdrop slot ring) — one interval no matter how many
 * subscribers.
 */

const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

export function subscribeTick(fn: () => void): () => void {
  listeners.add(fn)
  if (timer == null) {
    timer = setInterval(() => {
      for (const listener of listeners) listener()
    }, 1000)
  }
  return () => {
    listeners.delete(fn)
    if (listeners.size === 0 && timer != null) {
      clearInterval(timer)
      timer = null
    }
  }
}
