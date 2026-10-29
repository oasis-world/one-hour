import { useEffect, useState } from 'react'
import type { AccountState } from '../lib/account'
import { getProfileExpiresAt, preWelcomeProfile, type UserProfile } from '../lib/userProfile'
import { useLang } from '../lib/i18n'
import AvatarBadge from './AvatarBadge'
import AccountPopover from './AccountPopover'

export default function ChatTopAvatar({
  account,
  profile,
}: {
  account: AccountState
  profile: UserProfile | null
}) {
  const lang = useLang()
  const zh = lang === 'zh'
  const [open, setOpen] = useState(false)
  const [remainingMs, setRemainingMs] = useState(0)
  const shown = profile ?? preWelcomeProfile()
  const label = shown.nickname

  useEffect(() => {
    const tick = () => {
      const exp = getProfileExpiresAt()
      setRemainingMs(exp ? Math.max(0, exp - Date.now()) : 0)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [profile])

  const lifetime = 60 * 60 * 1000
  const progress = remainingMs > 0 ? remainingMs / lifetime : 0
  const critical = remainingMs > 0 && remainingMs < 2 * 60 * 1000
  const showNumber = remainingMs > 0 && remainingMs < 10 * 60 * 1000

  const formatCountdown = (ms: number) => {
    const total = Math.ceil(ms / 1000)
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="chat-top-avatar">
      <button
        type="button"
        className={`chat-top-avatar-btn${critical ? ' is-critical' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={zh ? `账号：${label}` : `Account: ${label}`}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ ['--avatar-progress' as string]: String(progress) }}
      >
        <AvatarBadge look={shown} fill className="chat-top-avatar-img" />
      </button>
      {showNumber && (
        <span className={`chat-top-avatar-countdown${critical ? ' is-critical' : ''}`}>
          {formatCountdown(remainingMs)}
        </span>
      )}
      {open && (
        <AccountPopover
          account={account}
          profile={shown}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
