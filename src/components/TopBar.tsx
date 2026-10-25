import { useState } from 'react'
import type { AccountState } from '../lib/account'
import type { ThemeName } from '../lib/settings'
import type { PresenceMember } from '../lib/chatTypes'
import { useLang } from '../lib/i18n'
import { useViewportNarrow } from '../lib/media'
import { isAutoTravelerName, loadChatNickname } from '../lib/nickname'
import { userAvatarTint } from '../lib/identity'
import { ChevronDownIcon, MoonIcon, PeopleIcon, SunIcon, TravelerGlyph } from './icons'
import OnlineList from './OnlineList'

/**
 * Top-left corner. Desktop: a vertical column of four matching glass
 * controls — avatar (login/register), online count (opens the member
 * list), theme toggle, language toggle. Phones: the column collapses
 * into one chevron chip; tapping it unfolds the icons with a staggered
 * pop-in.
 */
export default function TopBar({
  account,
  members,
  selfId,
  theme,
  onAvatarClick,
  onToggleTheme,
  onToggleLang,
}: {
  account: AccountState
  members: PresenceMember[]
  selfId: string | null
  theme: ThemeName
  onAvatarClick: () => void
  onToggleTheme: () => void
  onToggleLang: () => void
}) {
  const lang = useLang()
  const zh = lang === 'zh'
  const narrow = useViewportNarrow()
  const [expanded, setExpanded] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const showIcons = !narrow || expanded
  const onlineCount = members.length

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
  const toggleLabel = expanded
    ? zh
      ? '收起工具栏'
      : 'Collapse toolbar'
    : zh
      ? '展开工具栏'
      : 'Expand toolbar'

  return (
    <div className="top-bar">
      {narrow && (
        <button
          type="button"
          className="top-chip top-chip-btn top-toggle-btn"
          onClick={() => setExpanded((v) => !v)}
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-expanded={expanded}
        >
          <span className={`top-chevron${expanded ? ' is-open' : ''}`}>
            <ChevronDownIcon size={14} />
          </span>
        </button>
      )}

      {showIcons && (
        <div className="top-bar-icons">
          <button
            type="button"
            className="top-avatar-btn"
            style={{ ['--chip-i' as string]: 0 }}
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
            style={{ ['--chip-i' as string]: 1 }}
            title={zh ? `当前在线 ${onlineCount} 人` : `${onlineCount} online now`}
          >
            <button
              type="button"
              className="top-chip-btn top-chip-hit"
              onClick={() => setListOpen((v) => !v)}
              aria-label={zh ? `在线 ${onlineCount} 人，点击查看` : `${onlineCount} online, tap to view`}
              aria-expanded={listOpen}
            >
              <PeopleIcon size={15} />
            </button>
            <span className="top-badge">{onlineCount}</span>
          </span>

          <button
            type="button"
            className="top-chip top-chip-btn"
            style={{ ['--chip-i' as string]: 2 }}
            onClick={onToggleTheme}
            aria-label={themeLabel}
            title={themeLabel}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          <button
            type="button"
            className="top-chip top-chip-btn top-lang-btn"
            style={{ ['--chip-i' as string]: 3 }}
            onClick={onToggleLang}
            aria-label={zh ? 'Switch to English' : '切换到中文'}
            title={zh ? 'Switch to English' : '切换到中文'}
          >
            {zh ? 'EN' : '中'}
          </button>
        </div>
      )}

      {listOpen && (
        <OnlineList members={members} selfId={selfId} onClose={() => setListOpen(false)} />
      )}
    </div>
  )
}
