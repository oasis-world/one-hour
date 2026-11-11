import { t } from '../lib/i18n'
import PlayGamesIcon from './PlayGamesIcon'
import { ChatBubbleIcon } from './icons'
import './CompanionGreetingActions.css'

export default function CompanionGreetingActions({ onPrivateChat, onOpenGames }: {
  onPrivateChat: () => void
  onOpenGames?: () => void
}) {
  return (
    <div className="msg-greeting-actions">
      <button type="button" className="msg-greeting-private-btn" onClick={onPrivateChat}>
        <ChatBubbleIcon size={18} />
        {t('进入私聊', 'Private chat')}
      </button>
      {onOpenGames && (
        <button type="button" className="msg-greeting-games-btn" onClick={onOpenGames}>
          <PlayGamesIcon size={18} />
          <span>{t('玩游戏', 'Play Games')}</span>
        </button>
      )}
    </div>
  )
}
