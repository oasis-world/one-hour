import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react'
import { t } from '../lib/i18n'
import { useImeEnter } from '../lib/ime'
import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS, POLL_OPTION_MAX } from '../lib/pollTypes'

interface Props {
  options: string[]
  filledCount: number
  optionRefs: RefObject<Array<HTMLInputElement | null>>
  onSetOption: (index: number, value: string) => void
  onAddOption: () => void
  onRemoveOption: (index: number) => void
  onEnter: (index: number) => (e: ReactKeyboardEvent<HTMLInputElement>) => void
  ime: ReturnType<typeof useImeEnter>
}

/** Dynamic answer rows: letter chip + input + remove, until 8. */
export default function PollOptionsEditor({
  options, filledCount, optionRefs, onSetOption, onAddOption, onRemoveOption, onEnter, ime,
}: Props) {
  return (
    <div className="poll-modal-field">
      <span className="poll-modal-label">
        {t('选项', 'Options')}
        <span className="poll-modal-count">{filledCount}/{POLL_MAX_OPTIONS}</span>
      </span>
      <div className="poll-modal-options">
        {options.map((value, index) => (
          <span key={index} className="field-input-wrap poll-modal-option-row">
            <span className="poll-modal-letter">{String.fromCharCode(65 + index)}</span>
            <input
              ref={(el) => { optionRefs.current[index] = el }}
              type="text"
              value={value}
              maxLength={POLL_OPTION_MAX}
              placeholder={t('选项 {index}', 'Option {index}').replace('{index}', String(index + 1))}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => onSetOption(index, e.target.value)}
              onKeyDown={onEnter(index)}
              {...ime.imeProps}
            />
            {options.length > POLL_MIN_OPTIONS && (
              <button
                type="button"
                className="field-clear"
                aria-label={t('删除此选项', 'Remove this option')}
                tabIndex={-1}
                onPointerDown={(e) => { e.preventDefault() }}
                onMouseDown={(e) => { e.preventDefault() }}
                onClick={() => onRemoveOption(index)}
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {options.length < POLL_MAX_OPTIONS && (
        <button type="button" className="poll-modal-add" onClick={onAddOption}>
          ＋ {t('添加选项', 'Add option')}
        </button>
      )}
    </div>
  )
}
