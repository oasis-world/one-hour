import { COUNTDOWN_ANIMATIONS, type CountdownAnimation } from '../lib/countdownAnimations'
import { t } from '../lib/i18n'
import CountdownVisual from './CountdownVisual'

export default function CountdownAnimationPicker({
  selected,
  onSelect,
  onBack,
}: {
  selected: CountdownAnimation
  onSelect: (animation: CountdownAnimation) => void
  onBack: () => void
}) {
  return (
    <div className="settings-pop countdown-animation-pop" role="dialog" aria-label={t('倒计时动画', 'Countdown animation')}>
      <button type="button" className="settings-subview-back" onClick={onBack}>
        <span aria-hidden="true">‹</span>
        {t('设置', 'Settings')}
      </button>
      <h2 className="animation-picker-title">{t('倒计时动画', 'Countdown animation')}</h2>
      <div className="animation-option-list" role="group" aria-label={t('动画方案', 'Animation style')}>
        {COUNTDOWN_ANIMATIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`animation-option${selected === option.id ? ' is-selected' : ''}`}
            aria-pressed={selected === option.id}
            onClick={() => onSelect(option.id)}
          >
            <span className="animation-option-preview">
              <CountdownVisual remaining={0.64} size={18} previewScheme={option.id} />
            </span>
            <span className="animation-option-copy">
              <span className="animation-option-name">{t(option.zh, option.en)}</span>
              <span className="animation-option-detail">{t(option.detailZh, option.detailEn)}</span>
            </span>
            <span className="animation-option-check" aria-hidden="true">
              {selected === option.id ? '✓' : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
