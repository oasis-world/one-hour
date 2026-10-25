import { useState } from 'react'
import type { AccountState } from '../lib/account'
import type { UserProfile } from '../lib/userProfile'
import { useLang } from '../lib/i18n'
import { useHoverCapable } from '../lib/media'
import { useHoverReveal } from '../lib/useHoverReveal'
import AvatarBadge from './AvatarBadge'
import AccountPopover from './AccountPopover'

/**
 * Top-left corner: the player's DiceBear face (large). Hover (desktop)
 * or click opens the account popover — nickname at a glance, sign-in
 * for travelers, profile + sign-out once an email identity is bound.
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
  const hover = useHoverCapable()
  const { onEnter, onLeave } = useHoverReveal(
    hover,
    () => setOpen(true),
    () => setOpen(false),
  )
  const label = profile?.nickname ?? (zh ? '旅人' : 'Traveler')

  return (
    <div className="top-bar" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <button
        type="button"
        className="top-avatar-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={zh ? `账号：${label}` : `Account: ${label}`}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <AvatarBadge look={profile} fill className="top-avatar-img" />
      </button>

      {open && (
        <AccountPopover
          account={account}
          profile={profile}
          onClose={() => setOpen(false)}
          onSignIn={onSignIn}
          onOpenProfile={onOpenProfile}
          onOpenWelcome={onOpenWelcome}
        />
      )}
    </div>
  )
}
