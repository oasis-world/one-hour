import PlayGamesIcon from './PlayGamesIcon'
import { t } from '../lib/i18n'
import './ComposerGamesButton.css'

export default function ComposerGamesButton({ onClick }: { onClick: () => void }) {
  const keepFocus = (event: React.SyntheticEvent<HTMLButtonElement>) => event.preventDefault()

  return (
    <button
      type="button"
      className="composer-games-btn"
      aria-label={t('玩游戏', 'Play games')}
      title={t('玩游戏', 'Play games')}
      onMouseDown={keepFocus}
      onPointerDown={keepFocus}
      onClick={onClick}
    >
      <PlayGamesIcon size={21} />
    </button>
  )
}
