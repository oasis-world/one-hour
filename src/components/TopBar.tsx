import { useEffect, useState } from 'react'
import type { AccountState } from '../lib/account'
import { preWelcomeProfile, type UserProfile } from '../lib/userProfile'
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
  onSignIn: () => void
  onOpenProfile: () => void
  onOpenWelcome: () => void
}) {
  const lang = useLang()
  const zh = lang === 'zh'
  const [open, setOpen] = useState(false)
  const shown = profile ?? preWelcomeProfile()
  const label = shown.nickname

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
        className="top-avatar-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={zh ? `账号：${label}` : `Account: ${label}`}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <AvatarBadge look={shown} fill className="top-avatar-img" />
      </button>

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
