import { useEffect, useState } from 'react'

/** A clock that re-renders on an interval, for time-based UI (expiry, countdowns). */
export function useLiveNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}
