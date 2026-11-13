import { matchText as m } from './matchText'

function SoundIcon({ enabled }: { enabled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      {enabled
        ? <><path d="M16 9a5 5 0 0 1 0 6" /><path d="M18.5 6.5a8.5 8.5 0 0 1 0 11" /></>
        : <path className="m3-sound-slash" d="m5 5 14 14" />}
    </svg>
  )
}

export default function Match3SoundToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`m3-icon-btn m3-sound-btn${enabled ? ' is-on' : ''}`}
      aria-pressed={enabled}
      aria-label={m(enabled ? '关闭音效' : '开启音效', enabled ? 'Sound off' : 'Sound on')}
      title={m(enabled ? '关闭音效' : '开启音效', enabled ? 'Sound off' : 'Sound on')}
      onClick={onToggle}
    >
      <SoundIcon enabled={enabled} />
    </button>
  )
}
