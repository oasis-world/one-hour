import { t } from '../lib/i18n'

/** Loading skeleton + offline error while a poll card syncs its ballot. */
export function PollLoading() {
  return (
    <div className="poll-card is-loading">
      <div className="poll-skeleton" />
      <div className="poll-skeleton" />
      <div className="poll-skeleton" />
    </div>
  )
}

export function PollUnavailable({ canRetry, onRetry }: { canRetry: boolean; onRetry: () => void }) {
  return (
    <div className="poll-card is-error">
      <p>{t('投票暂时不可用，请稍后重试', 'This poll is temporarily unavailable')}</p>
      {canRetry && (
        <button type="button" className="poll-retry" onClick={onRetry}>
          {t('重试', 'Retry')}
        </button>
      )}
    </div>
  )
}
