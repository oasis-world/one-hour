import { t } from '../lib/i18n'
import { HourglassIcon } from './icons'

interface Props {
  question: string
  filledOptions: string[]
  multiple: boolean
  durationText: string
}

/** Static miniature of the card everyone will see (draft only). */
export default function PollModalPreview({ question, filledOptions, multiple, durationText }: Props) {
  return (
    <div className="poll-modal-preview" aria-hidden="true">
      <span className="poll-modal-preview-tag">{t('预览', 'Preview')}</span>
      <div className="poll-modal-preview-q">{question.trim() || t('这里会显示你的问题…', 'Your question appears here…')}</div>
      <div className="poll-modal-preview-opts">
        {filledOptions.map((opt, i) => (
          <span key={i} className="poll-modal-preview-opt"><i>{String.fromCharCode(65 + i)}</i>{opt}</span>
        ))}
        {filledOptions.length === 0 && (
          <span className="poll-modal-preview-opt is-empty">{t('填写问题与选项后，这里就会是投票卡片的样子', 'Fill in the question and options — the card previews here')}</span>
        )}
      </div>
      <span className="poll-modal-preview-meta">
        <span>{multiple ? t('多选', 'Multi') : t('单选', 'Single')} ·</span>
        <HourglassIcon size={11} progress={1} />
        <span>{durationText}</span>
      </span>
    </div>
  )
}
