import { useEffect, useState } from 'react'
import type { AccountState } from '../lib/account'
import { getProfileExpiresAt, preWelcomeProfile, type UserProfile } from '../lib/userProfile'
import { useLang } from '../lib/i18n'
import { setPopoverOpen } from '../lib/popoverGuard'
import AvatarBadge from './AvatarBadge'
import AccountPopover from './AccountPopover'

/**
 * Top-left corner: the player's DiceBear face (large). Click it to
 * toggle the account popover — nickname at a glance, sign-in for
 * travelers, profile + sign-out once an email identity is bound. A
 * click outside (or Escape) closes it; there is no hover-to-open.
 * Before the welcome confirm the shared random draft plays the part,
 * matching what the welcome gate offers.
 */
export default function TopBar({
  account,
  profile,
  onSignIn,
  onOpenProfile,
  onOpenWelcome,
}: {
  account: AccountState
  profile: UserProfile | null
  onSignIn?: () => void
  onOpenProfile?: () => void
  onOpenWelcome?: () => void
}) {
  const lang = useLang()
  const zh = lang === 'zh'
  const [open, setOpen] = useState(false)
  const shown = profile ?? preWelcomeProfile()
  const label = shown.nickname

  const [remainingMs, setRemainingMs] = useState(0)
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

  // Report to the chat-stage fold guard so a blank click that dismisses
  // this popover doesn't also fold the chat (see popoverGuard.ts).
  useEffect(() => {
    if (!open) return
    setPopoverOpen(true)
    return () => setPopoverOpen(false)
  }, [open])

  return (
    <div className="top-bar">
      <button
        type="button"
        className={`top-avatar-btn${critical ? ' is-critical' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={zh ? `账号：${label}` : `Account: ${label}`}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ ['--avatar-progress' as string]: String(progress) }}
      >
        <AvatarBadge look={shown} fill className="top-avatar-img" />
      </button>
      {showNumber && (
        <span className="top-avatar-countdown">{formatCountdown(remainingMs)}</span>
      )}

      {open && (
        <AccountPopover
          account={account}
          profile={shown}
          onClose={() => setOpen(false)}
          onSignIn={onSignIn}
          onOpenProfile={onOpenProfile}
          onOpenWelcome={onOpenWelcome}
        />
      )}
    </div>
  )
}
