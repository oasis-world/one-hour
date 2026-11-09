import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react'
import { t } from '../lib/i18n'
import { useImeEnter } from '../lib/ime'
import { POLL_QUESTION_MAX } from '../lib/pollTypes'

interface Props {
  question: string
  questionRef: RefObject<HTMLInputElement | null>
  onChange: (value: string) => void
  onEnter: (e: ReactKeyboardEvent<HTMLInputElement>) => void
  ime: ReturnType<typeof useImeEnter>
}

/** Poll question input with an in-field clear button and char budget. */
export default function PollQuestionField({ question, questionRef, onChange, onEnter, ime }: Props) {
  return (
    <label className="field poll-modal-field">
      <span className="poll-modal-label">
        {t('问题', 'Question')}
        <span className="poll-modal-count">{question.length}/{POLL_QUESTION_MAX}</span>
      </span>
      <span className="field-input-wrap">
        <input
          ref={questionRef}
          type="text"
          value={question}
          maxLength={POLL_QUESTION_MAX}
          placeholder={t('大家要决定什么？', 'What should we decide?')}
          spellCheck={false}
          autoComplete="off"
          autoFocus={typeof window !== 'undefined' && !window.matchMedia('(pointer: coarse)').matches}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onEnter}
          {...ime.imeProps}
        />
        {question && (
          <button
            type="button"
            className="field-clear"
            aria-label={t('清空', 'Clear')}
            tabIndex={-1}
            onPointerDown={(e) => { e.preventDefault() }}
            onMouseDown={(e) => { e.preventDefault() }}
            onClick={() => onChange('')}
          >
            ×
          </button>
        )}
      </span>
    </label>
  )
}
