import { useEffect, useRef, useState } from 'react'
import { signOutAccount, type AccountState } from '../lib/account'
import { useLang } from '../lib/i18n'
import type { UserProfile } from '../lib/userProfile'
import AvatarBadge from './AvatarBadge'
import { RefreshIcon, SignOutIcon, UserIcon } from './userIcons'

/**
 * Menu behind the top-left avatar: who you are (nickname + identity
 * line), then either the sign-in entry for travelers or the profile page
 * and sign-out actions for signed-in players.
 */
export default function AccountPopover({
  account,
  profile,
  onClose,
  onSignIn,
  onOpenProfile,
  onOpenWelcome,
}: {
  account: AccountState
  profile: UserProfile | null
  onClose: () => void
  onSignIn: () => void
  onOpenProfile: () => void
  onOpenWelcome: () => void
}) {
  const lang = useLang()
  const zh = lang === 'zh'
  const popRef = useRef<HTMLDivElement>(null)
  const signedIn = account.status === 'signedIn'
  const [confirmingOut, setConfirmingOut] = useState(false)

  useEffect(() => {
    // Clicks on the top bar itself belong to the avatar toggle.
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (popRef.current?.contains(target)) return
      if (target?.closest?.('.top-bar')) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const act = (fn: () => void) => () => {
    onClose()
    fn()
  }

  const signOut = act(() => {
    void signOutAccount()
  })

  return (
    <div className="account-pop" ref={popRef} role="menu" aria-label={zh ? '账号' : 'Account'}>
      <div className="account-pop-head">
        <AvatarBadge look={profile} size={52} />
        <div className="account-pop-id">
          <span className="account-pop-name">
            {profile?.nickname ?? (zh ? '旅人' : 'Traveler')}
          </span>
          <span className="account-pop-sub">
            {signedIn
              ? `${account.email ?? ''} · ${zh ? '已同步云端' : 'synced to cloud'}`
              : zh
                ? '旅人身份 · 仅保存在本机'
                : 'Traveler · saved on this device only'}
          </span>
        </div>
      </div>

      <div className="account-pop-actions">
        {signedIn ? (
          confirmingOut ? (
            <>
              <p className="account-pop-confirm">
                {zh ? '确定要退出登录吗？' : 'Sign out of this device?'}
              </p>
              <div className="account-pop-confirm-row">
                <button
                  type="button"
                  className="account-pop-item"
                  role="menuitem"
                  onClick={() => setConfirmingOut(false)}
                >
                  {zh ? '取消' : 'Cancel'}
                </button>
                <button
                  type="button"
                  className="account-pop-item is-danger"
                  role="menuitem"
                  onClick={signOut}
                >
                  {zh ? '退出登录' : 'Sign out'}
                </button>
              </div>
            </>
          ) : (
            <>
              <button type="button" className="account-pop-item" role="menuitem" onClick={act(onOpenProfile)}>
                <UserIcon size={15} />
                {zh ? '个人资料' : 'Profile'}
              </button>
              <button type="button" className="account-pop-item is-danger" role="menuitem" onClick={() => setConfirmingOut(true)}>
                <SignOutIcon size={15} />
                {zh ? '退出登录' : 'Sign out'}
              </button>
            </>
          )
        ) : (
          <>
            <button type="button" className="account-pop-item" role="menuitem" onClick={act(onOpenWelcome)}>
              <RefreshIcon size={15} />
              {zh ? '换个头像和昵称' : 'New avatar & nickname'}
            </button>
            <button type="button" className="account-pop-item" role="menuitem" onClick={act(onSignIn)}>
              <UserIcon size={15} />
              {zh ? '登录' : 'Sign in'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
