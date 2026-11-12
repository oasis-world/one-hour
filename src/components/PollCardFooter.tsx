import { t } from '../lib/i18n'

interface Props {
  voterCount: number
  totalVotes: number
  remainingLabel: string
  canClose: boolean
  closeDisabled: boolean
  onClose: () => void
}

export default function PollCardFooter({ voterCount, totalVotes, remainingLabel, canClose, closeDisabled, onClose }: Props) {
  const voteSummary = t('{voters} 人参与 · {votes} 票', '{voters} voters · {votes} votes')
    .replace('{voters}', String(voterCount))
    .replace('{votes}', String(totalVotes))
  return (
    <footer className="poll-foot">
      <span>
        {voterCount > 0
          ? voteSummary
          : t('等待大家投票…', 'Waiting for votes…')}
      </span>
      <span className="poll-time">{remainingLabel}</span>
      {canClose && (
        <button type="button" className="poll-close-btn" disabled={closeDisabled} onClick={onClose}>
          {t('关闭投票', 'Close poll')}
        </button>
      )}
    </footer>
  )
}
