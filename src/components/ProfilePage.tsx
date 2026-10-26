import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { AccountState } from '../lib/account'
import { useLang } from '../lib/i18n'
import { useImeEnter } from '../lib/ime'
import { isSupabaseConfigured } from '../lib/supabaseConfig'
import { randomAvatarLook, randomAvatarSeed } from '../lib/avatar'
import { pushProfileToCloud } from '../lib/profileCloud'
import {
  cleanNickname,
  loadUserProfile,
  NICKNAME_MAX,
  randomNickname,
  saveUserProfile,
  type UserProfile,
} from '../lib/userProfile'
import AvatarEditor from './AvatarEditor'
import { ThinXIcon } from './icons'
import { UserIcon } from './userIcons'

/**
 * Simple profile page (modal): reroll the DiceBear look, edit the
 * nickname, see where the identity lives. Saving writes the local store
 * first and mirrors to the cloud when an email identity is bound.
 */
export default function ProfilePage({
  account,
  onClose,
  onOpenSignIn,
}: {
  account: AccountState
  onClose: () => void
  onOpenSignIn: () => void
}) {
  const lang = useLang()
  const zh = lang === 'zh'
  const signedIn = account.status === 'signedIn'
  const ime = useImeEnter()
  const nicknameRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<UserProfile | null>(() => loadUserProfile())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!draft) return null

  const rerollLook = () => {
    setDraft((prev) => (prev ? { ...prev, ...randomAvatarLook(prev), avatarUrl: null } : prev))
    nicknameRef.current?.focus()
  }

  /** Adopt a catalog style (row button also rolls a fresh seed). */
  const pickStyle = (style: string, rerollSeed: boolean) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            style,
            seed: rerollSeed ? randomAvatarSeed() : prev.seed,
            avatarUrl: null,
          }
        : prev,
    )
    nicknameRef.current?.focus()
  }

  const save = () => {
    const nickname =
      cleanNickname(draft.nickname) || randomNickname(draft.nickname, lang)
    saveUserProfile({
      nickname,
      style: draft.style,
      seed: draft.seed,
      avatarUrl: draft.avatarUrl ?? null,
    })
    if (signedIn) void pushProfileToCloud()
    onClose()
  }

  const onNickEnter = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    // An IME's Enter commits the candidates — never our business logic.
    if (ime.imeConsumesEnter(e)) return
    if (e.key !== 'Enter') return
    e.preventDefault()
    save()
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="account-dialog profile-page"
        role="dialog"
        aria-modal="true"
        aria-label={zh ? '个人资料' : 'Profile'}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="profile-head">
          <h3 className="account-title">{zh ? '个人资料' : 'Profile'}</h3>
        </header>
        <button
          type="button"
          className="account-close"
          onClick={onClose}
          aria-label={zh ? '关闭' : 'Close'}
        >
          <ThinXIcon size={15} />
        </button>

        <div className="profile-body">
          <AvatarEditor
            look={draft}
            size={96}
            avatarClassName="profile-avatar"
            allowUpload={signedIn}
            onReroll={rerollLook}
            onPickStyle={pickStyle}
            onUploaded={(url) => setDraft((prev) => (prev ? { ...prev, avatarUrl: url } : prev))}
          />

          <label className="field">
            <span>{zh ? '昵称' : 'Nickname'}</span>
            <input
            ref={nicknameRef}
            type="text"
            value={draft.nickname}
              maxLength={NICKNAME_MAX}
              spellCheck={false}
              onChange={(e) => setDraft({ ...draft, nickname: e.target.value })}
              onKeyDown={onNickEnter}
              {...ime.imeProps}
            />
          </label>

          <div className="profile-meta">
            <UserIcon size={14} />
            {signedIn ? (
              <span>
                {account.email}
                {zh ? ' · 头像与昵称已同步云端' : ' · avatar & nickname synced to cloud'}
              </span>
            ) : isSupabaseConfigured() ? (
              <>
                <span>{zh ? '旅人身份，资料仅保存在本机。' : 'Traveler — profile saved on this device only.'}</span>
                <button type="button" className="profile-bind" onClick={onOpenSignIn}>
                  {zh ? '绑定邮箱，多设备同步' : 'Bind an email to sync'}
                </button>
              </>
            ) : (
              <span>{zh ? '同步服务未配置，资料仅保存在本机。' : 'Sync not configured — profile stays on this device.'}</span>
            )}
          </div>

          <div className="account-actions">
            <button type="button" className="btn-accent" onClick={save}>
              {zh ? '保存' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
