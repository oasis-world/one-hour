import Match3Icon from './Match3Icon'
import Match3SoundToggle from './Match3SoundToggle'
import { matchText as m } from './matchText'

interface Match3HeaderProps {
  soundEnabled: boolean
  onToggleSound: () => void
  onOpenHelp: () => void
}

export default function Match3Header({ soundEnabled, onToggleSound, onOpenHelp }: Match3HeaderProps) {
  return (
    <header className="m3-header">
      <div className="m3-brand">
        <span className="m3-logo"><Match3Icon size={26} /></span>
        <strong>{m('三消', 'Match-3')}</strong>
      </div>
      <div className="m3-tools">
        <Match3SoundToggle enabled={soundEnabled} onToggle={onToggleSound} />
        <button type="button" className="m3-icon-btn" aria-label={m('游戏说明', 'How to play')} onClick={onOpenHelp}>?</button>
      </div>
    </header>
  )
}
