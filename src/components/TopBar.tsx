import type { AccountState } from '../lib/account'
import type { ThemeName } from '../lib/settings'
import { useLang } from '../lib/i18n'
import { isAutoTravelerName, loadChatNickname } from '../lib/nickname'
import { userAvatarTint } from '../lib/identity'
import { MoonIcon, PeopleIcon, SunIcon, TravelerGlyph } from './icons'

/**
 * Top-left corner, a vertical column of four matching glass controls:
 * avatar (login/register), online count (badge), theme toggle, language
 * toggle. Small, uniform, quiet.
 */
export default function TopBar({
  account,
  onlineCount,
  theme,
  onAvatarClick,
  onToggleTheme,
  onToggleLang,
}: {
  account: AccountState
  onlineCount: number
  theme: ThemeName
  onAvatarClick: () => void
  onToggleTheme: () => void
  onToggleLang: () => void
}) {
  const lang = useLang()
  const zh = lang === 'zh'
  const displayName = loadChatNickname(lang)
  const accountLabel =
    account.status === 'signedIn'
      ? account.email ?? (zh ? '账号' : 'Account')
      : zh
        ? '登录 / 注册'
        : 'Sign in / Sign up'
  const themeLabel = theme === 'dark'
    ? zh
      ? '切换到暖色主题'
      : 'Switch to warm theme'
    : zh
      ? '切换到深色主题'
      : 'Switch to dark theme'

  return (
    <div className="top-bar">
      <button
        type="button"
        className="top-avatar-btn"
        onClick={onAvatarClick}
        aria-label={accountLabel}
        title={accountLabel}
      >
        <span
          className="top-avatar-letter"
          style={{ background: userAvatarTint(account.userId ?? 'guest') }}
        >
          {isAutoTravelerName(displayName) ? (
            <TravelerGlyph size={18} />
          ) : (
            displayName.slice(0, 1).toUpperCase()
          )}
        </span>
      </button>

      <span
        className="top-chip"
        title={zh ? `当前在线 ${onlineCount} 人` : `${onlineCount} online now`}
      >
        <PeopleIcon size={15} />
        <span className="top-badge">{onlineCount}</span>
      </span>

      <button
        type="button"
        className="top-chip top-chip-btn"
        onClick={onToggleTheme}
        aria-label={themeLabel}
        title={themeLabel}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>

      <button
        type="button"
        className="top-chip top-chip-btn top-lang-btn"
        onClick={onToggleLang}
        aria-label={zh ? 'Switch to English' : '切换到中文'}
        title={zh ? 'Switch to English' : '切换到中文'}
      >
        {zh ? 'EN' : '中'}
      </button>
    </div>
  )
}
