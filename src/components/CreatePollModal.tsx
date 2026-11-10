import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useImeEnter } from '../lib/ime'
import { setPopoverOpen } from '../lib/popoverGuard'
import { t, useLang } from '../lib/i18n'
import {
  POLL_DURATIONS,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  validatePollDraft,
  type PollDraft,
  type PollDurationId,
} from '../lib/pollTypes'
import { ThinXIcon, VoteIcon } from './icons'
// Preview hidden for now (per request) — restore from git to re-enable.
// import PollModalPreview from './PollModalPreview'
import PollModalSeg from './PollModalSeg'
import PollOptionsEditor from './PollOptionsEditor'
import PollQuestionField from './PollQuestionField'
import './CreatePollModal.css'

interface Props {
  /** Returns true when the poll actually left (modal then closes). */
  onSend: (draft: PollDraft) => Promise<boolean>
  onClose: () => void
}

export default function CreatePollModal({ onSend, onClose }: Props) {
  useLang()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [multiple, setMultiple] = useState(false)
  const [durationId, setDurationId] = useState<PollDurationId>('1h')
  const [sending, setSending] = useState(false)
  const [focusReq, setFocusReq] = useState<{ idx: number; seq: number } | null>(null)
  const questionRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<Array<HTMLInputElement | null>>([])
  const ime = useImeEnter()

  const draftError = validatePollDraft(question, options)
  const canSend = !draftError && !sending
  const filledOptions = options.map((o) => o.trim()).filter(Boolean)

  useEffect(() => {
    // Popover guard: a dismissal under this modal must not fold the chat.
    setPopoverOpen(true)
    return () => setPopoverOpen(false)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, sending])

  useEffect(() => {
    if (!focusReq) return
    optionRefs.current[focusReq.idx]?.focus()
  }, [focusReq])

  const requestFocus = (idx: number) =>
    setFocusReq((prev) => ({ idx, seq: (prev?.seq ?? 0) + 1 }))
  const setOption = (index: number, value: string) =>
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)))
  const addOption = () => {
    if (options.length >= POLL_MAX_OPTIONS) return
    setOptions((prev) => [...prev, ''])
    requestFocus(options.length)
  }
  const removeOption = (index: number) => {
    if (options.length <= POLL_MIN_OPTIONS) return
    setOptions((prev) => prev.filter((_, i) => i !== index))
  }
  const focusFirstEmptyOption = () => {
    const idx = options.findIndex((o) => !o.trim())
    requestFocus(idx === -1 ? options.length - 1 : idx)
  }
  const onQuestionEnter = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (ime.imeConsumesEnter(e)) return
    if (e.key !== 'Enter') return
    e.preventDefault()
    focusFirstEmptyOption()
  }
  const onOptionEnter = (index: number) => (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (ime.imeConsumesEnter(e)) return
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (index < options.length - 1) requestFocus(index + 1)
    else if (options.length < POLL_MAX_OPTIONS) addOption()
  }

  const submit = () => {
    if (!canSend) return
    setSending(true)
    void onSend({ question: question.trim(), options: filledOptions, multiple, durationId })
      .then((ok) => {
        if (ok) onClose()
        else setSending(false)
      })
      .catch(() => setSending(false))
  }

  return (
    <div
      className="poll-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onClose()
      }}
    >
      <div className="poll-modal-card" role="dialog" aria-modal="true" aria-label={t('发起投票', 'New poll')}>
        <header className="poll-modal-head">
          <span className="poll-modal-tile"><VoteIcon size={22} /></span>
          <span className="poll-modal-titles">
            <strong>{t('发起投票', 'New poll')}</strong>
            <small>{t('全员可见 · 实时统计 · 1 小时后消散', 'Visible to all · live results · fades in 1 hour')}</small>
          </span>
          <button
            type="button"
            className="poll-modal-x"
            disabled={sending}
            onClick={onClose}
            aria-label={t('关闭', 'Close')}
          >
            <ThinXIcon size={15} />
          </button>
        </header>

        <PollQuestionField
          question={question}
          questionRef={questionRef}
          onChange={setQuestion}
          onEnter={onQuestionEnter}
          ime={ime}
        />

        <PollOptionsEditor
          options={options}
          filledCount={filledOptions.length}
          optionRefs={optionRefs}
          onSetOption={setOption}
          onAddOption={addOption}
          onRemoveOption={removeOption}
          onEnter={onOptionEnter}
          ime={ime}
        />

        <PollModalSeg<string>
          label={t('投票方式', 'Voting type')}
          choices={[
            { value: 'single', label: t('单选', 'Single choice') },
            { value: 'multiple', label: t('多选', 'Multiple choices') },
          ]}
          value={multiple ? 'multiple' : 'single'}
          onChange={(v) => setMultiple(v === 'multiple')}
        />
        <PollModalSeg<PollDurationId>
          label={t('持续时间', 'Duration')}
          choices={POLL_DURATIONS.map((d) => ({ value: d.id, label: `${d.minutes}${t(' 分钟', ' min')}` }))}
          value={durationId}
          onChange={setDurationId}
        />
        {/* Preview hidden for now (per request). Restore to re-enable:
        <PollModalPreview
          question={question}
          filledOptions={filledOptions}
          multiple={multiple}
          durationText={`${durationMinutes}${t(' 分钟', ' min')}`}
        />
        */}

        <footer className="poll-modal-foot">
          <button type="button" className="btn-ghost" disabled={sending} onClick={onClose}>
            {t('取消', 'Cancel')}
          </button>
          <button type="button" className="btn-accent poll-modal-send" disabled={!canSend} onClick={submit}>
            {sending ? t('发布中…', 'Posting…') : t('发送投票', 'Send poll')}
          </button>
        </footer>
      </div>
    </div>
  )
}
