import type { SymbolId } from './model'
import type { ThemeArt } from './themes'
import { SEVEN_IMAGE } from './slotSound'

export function HelpIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.2" /><path d="M7.9 7.6a2.2 2.2 0 1 1 3.7 1.6c-.9.8-1.6 1.1-1.6 2.3" /><path d="M10 14.1v.1" /></svg>
}

export function SoundIcon({ enabled }: { enabled: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" />{enabled ? <><path d="M16 9a5 5 0 0 1 0 6" /><path d="M18.5 6.5a8.5 8.5 0 0 1 0 11" /></> : <path className="slot-sound-slash" d="m5 5 14 14" />}</svg>
}

export function JoystickIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v8" /><circle cx="12" cy="4.2" r="2.4" /><path d="M8 13h8l3.2 2.4a2.2 2.2 0 0 1-1.3 4H6.1a2.2 2.2 0 0 1-1.3-4L8 13Z" /><path d="M8 16.5h.1m7.8 0h.1" /></svg>
}

export function ShuffleIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h3.2c1.4 0 2.1.7 3 2l5.6 7c.7 1 1.4 1.6 2.8 1.6H21" /><path d="M3 17h3.2c1.4 0 2.1-.7 3-2l.8-1.1" /><path d="M14.5 9.2 15 8.6c.9-1.3 1.6-2 3-2H21" /><path d="m18 4 3 3-3 3M18 14l3 3-3 3" /></svg>
}

export function SymbolArt({ symbol, className, art }: { symbol: SymbolId; className: string; art: ThemeArt }) {
  return symbol === 'wild'
    ? <img className={`${className} slot-seven`} src={SEVEN_IMAGE} alt="" aria-hidden="true" />
    : <span className={className} aria-hidden="true">{art[symbol]}</span>
}
