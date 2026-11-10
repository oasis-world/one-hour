interface Props {
  text: string
  count: number
  pct: number
  selected: boolean
  isLead: boolean
  /** Null for non-interactive rendering (closed / no self). */
  disabled: boolean
  multiple: boolean
  onPick: () => void
}

/** One clickable option: behind-the-bar percentage and tick. */
export default function PollOption({
  text, count, pct, selected, isLead, disabled, multiple, onPick,
}: Props) {
  return (
    <button
      type="button"
      className={`poll-option${selected ? ' is-mine' : ''}${isLead ? ' is-lead' : ''}`}
      disabled={disabled}
      aria-pressed={multiple ? selected : undefined}
      aria-checked={!multiple ? selected : undefined}
      role={!multiple ? 'radio' : undefined}
      aria-label={`${text} — ${count}${count > 0 ? `, ${Math.round(pct * 100)}%` : ''}`}
      onClick={onPick}
    >
      <span className="poll-bar" style={{ width: `${Math.round(pct * 100)}%` }} aria-hidden="true" />
      <span className="poll-option-text">{text}</span>
      {selected && <span className="poll-check" aria-hidden="true">✓</span>}
      <span className="poll-count">{count > 0 ? `${Math.round(pct * 100)}% · ${count}` : ''}</span>
    </button>
  )
}
