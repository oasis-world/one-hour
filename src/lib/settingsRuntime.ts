import { saveBgTtlMs, saveTheme, saveVeil } from './settings'

/**
 * Runtime hooks for the settings surfaces: persist a value and ping the
 * shell through a custom event so the change applies without a reload.
 *   window.setOneHourVeil(0.6)          — chat background opacity 0–0.92
 *   window.setOneHourTheme('warm')      — 'warm' | 'dark' | null (= auto)
 *   window.setOneHourBgTtl(600000)      — backdrop rotation slot, ms (≥15s)
 */

declare global {
  interface Window {
    setOneHourVeil?(value: number): void
    setOneHourTheme?(theme: 'warm' | 'dark' | null): void
    setOneHourBgTtl?(ms: number): void
  }
}

export {}

if (typeof window !== 'undefined') {
  window.setOneHourVeil = (value: number) => {
    saveVeil(value)
    window.dispatchEvent(new Event('one-hour:veil'))
  }
  window.setOneHourTheme = (theme: 'warm' | 'dark' | null) => {
    saveTheme(theme)
    window.dispatchEvent(new Event('one-hour:theme'))
  }
  window.setOneHourBgTtl = (ms: number) => {
    saveBgTtlMs(ms)
    window.dispatchEvent(new Event('one-hour:bg-ttl'))
  }
}
