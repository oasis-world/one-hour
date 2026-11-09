interface Props<T extends string> {
  label: string
  choices: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}

/** Segmented single-select (STream-style "Voting type" / "Duration"). */
export default function PollModalSeg<T extends string>({ label, choices, value, onChange }: Props<T>) {
  return (
    <div className="poll-modal-field">
      <span className="poll-modal-label">{label}</span>
      <div className="poll-modal-seg" role="radiogroup" aria-label={label}>
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            className={value === choice.value ? 'is-on' : ''}
            role="radio"
            aria-checked={value === choice.value}
            onClick={() => onChange(choice.value)}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  )
}
