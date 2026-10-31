import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useLang, t } from '../lib/i18n'
import { resetStats } from '../lib/lifetimeStats'
import { useImeEnter } from '../lib/ime'
import { useAccount } from '../lib/useAccount'
import { pushProfileToCloud } from '../lib/profileCloud'
import {
  cleanNickname,
  cleanRole,
  loadUserProfile,
  NICKNAME_MAX,
  preWelcomeProfile,
  randomProfile,
  ROLE_MAX,
  saveUserProfile,
  setProfileExpiresAt,
  PROFILE_LIFETIME_MS,
  type UserProfile,
} from '../lib/userProfile'
import { randomAvatarSeed } from '../lib/avatar'
import AvatarEditor from './AvatarEditor'
import { BriefcaseIcon, ChatBubbleIcon, HourglassIcon, ThinXIcon } from './icons'

/**
 * The avatar + nickname picker, in two modes:
 * - 'welcome' — first visit gate: welcome copy, random identity, confirm
 *   enters the room (no close).
 * - 'edit' — reopened from the account menu ("New avatar & nickname"):
 *   starts from the current look, closable, save applies in place.
 */
export default function WelcomeModal({
  mode = 'welcome',
  onClose,
}: {
  mode?: 'welcome' | 'edit'
  onClose?: () => void
}) {
  const lang = useLang()
  const account = useAccount()
  const editing = mode === 'edit'
  const [draft, setDraft] = useState<UserProfile>(() =>
    editing
      ? loadUserProfile() ?? randomProfile(undefined, lang)
      : // First visit: start from the identity already shown in the room,
        // so the faces behind and inside the modal match from the start.
        preWelcomeProfile(),
  )
  const ime = useImeEnter()
  const nicknameRef = useRef<HTMLInputElement>(null)
  const roleRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  // Edit mode is dismissable; the first-visit gate is not.
  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const reroll = () => {
    setDraft((prev) => randomProfile(prev, lang))
  }

  /** Adopt a style from the catalog; the row button also rolls a new seed. */
  const pickStyle = (style: string, rerollSeed: boolean) => {
    setDraft((prev) => ({
      ...prev,
      style,
      seed: rerollSeed ? randomAvatarSeed() : prev.seed,
      // Choosing a generated look drops any custom photo.
      avatarUrl: null,
    }))
  }

  const confirm = () => {
    const nickname = cleanNickname(draft.nickname)
    const role = cleanRole(draft.role ?? '')
    if (!nickname) {
      setError(t('请输入昵称', 'Nickname is required'))
      nicknameRef.current?.focus()
      return
    }
    if (nickname.length < 2) {
      setError(t('昵称至少 2 个字符', 'Nickname must be at least 2 characters'))
      nicknameRef.current?.focus()
      return
    }
    if (!role) {
      setError(t('请输入角色', 'Role is required'))
      roleRef.current?.focus()
      return
    }
    if (role.length < 2) {
      setError(t('角色至少 2 个字符', 'Role must be at least 2 characters'))
      roleRef.current?.focus()
      return
    }
    setError(null)
    saveUserProfile({
      nickname,
      role,
      style: draft.style,
      seed: draft.seed,
      avatarUrl: draft.avatarUrl ?? null,
    })
    if (mode !== 'edit') resetStats()
    // Anonymous users also live for one hour: stamp the expiry now.
    setProfileExpiresAt(Date.now() + PROFILE_LIFETIME_MS)
    // Returning player with a live session: the pick belongs in the cloud.
    // Anonymous users also persist their profile + expiry for refresh sync.
    if (account.status === 'signedIn' || account.status === 'anonymous') void pushProfileToCloud()
    onClose?.()
  }

  const onNickEnter = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    // An IME's Enter commits the candidates — never our business logic.
    if (ime.imeConsumesEnter(e)) return
    if (e.key !== 'Enter') return
    e.preventDefault()
    confirm()
  }

  const onRoleEnter = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (ime.imeConsumesEnter(e)) return
    if (e.key !== 'Enter') return
    e.preventDefault()
    confirm()
  }

  return (
    <div
      className="welcome-backdrop"
      role="presentation"
      onClick={(e) => {
        // Edit mode is dismissable by clicking the backdrop; the
        // first-visit gate is not dismissable at all.
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div
        className="welcome-card"
        role="dialog"
        aria-modal="true"
        aria-label={t('欢迎', 'Welcome')}
      >
        <h2 className="welcome-title">
          <HourglassIcon size={15} />
          {editing
            ? t('我的形象', 'Your look')
            : t('一小时聊天室', 'the one-hour room')}
        </h2>

        {editing ? (
          <p className="welcome-copy">
            {t('换一个头像，或直接修改昵称。', 'Reroll the avatar, or edit your nickname.')}
          </p>
        ) : (
          <p className="welcome-copy">
            <strong>{t('欢迎来到一小时聊天室', 'Welcome to the one-hour room')}</strong>
            {t('每条消息只存在一个小时，留下的都是此刻，畅所欲言吧。', 'Every message lives for just one hour. Say what matters, now.')}
          </p>
        )}

        <AvatarEditor
          look={draft}
          size={106}
          allowUpload
          rerollLabel={t('换一个头像和昵称', 'Reroll avatar and nickname')}
          onReroll={reroll}
          onPickStyle={pickStyle}
          onUploaded={(url) => setDraft((prev) => ({ ...prev, avatarUrl: url }))}
        />

        <div className="welcome-fields">
          <label className="field welcome-field">
            <span className="field-input-wrap">
              <span className="field-icon" aria-hidden="true">
                <ChatBubbleIcon size={15} />
              </span>
              <input
                ref={nicknameRef}
                type="text"
                value={draft.nickname}
                maxLength={NICKNAME_MAX}
                placeholder={t('昵称', 'Nickname')}
                spellCheck={false}
                autoComplete="off"
                autoFocus={typeof window !== 'undefined' && !window.matchMedia('(pointer: coarse)').matches}
                onChange={(e) => {
                  setDraft({ ...draft, nickname: e.target.value })
                  setError(null)
                }}
                onKeyDown={onNickEnter}
                {...ime.imeProps}
              />
              {draft.nickname && (
                <button
                  type="button"
                  className="field-clear"
                  aria-label={t('清空', 'Clear')}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setDraft((prev) => ({ ...prev, nickname: '' }))
                  }}
                >
                  ×
                </button>
              )}
            </span>
          </label>

          <label className="field welcome-field">
            <span className="field-input-wrap">
              <span className="field-icon" aria-hidden="true">
                <BriefcaseIcon size={15} />
              </span>
              <input
                ref={roleRef}
                type="text"
                value={draft.role ?? ''}
                maxLength={ROLE_MAX}
                placeholder={t('角色', 'Role')}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => {
                  setDraft({ ...draft, role: e.target.value })
                  setError(null)
                }}
                onKeyDown={onRoleEnter}
                {...ime.imeProps}
              />
              {draft.role && (
                <button
                  type="button"
                  className="field-clear"
                  aria-label={t('清空', 'Clear')}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setDraft((prev) => ({ ...prev, role: '' }))
                  }}
                >
                  ×
                </button>
              )}
            </span>
          </label>
        </div>

        {error && <p className="welcome-error" role="alert">{error}</p>}
        <button type="button" className="btn-accent welcome-confirm" onClick={confirm}>
          {editing ? (t('保存', 'Save')) : t('开始聊天', 'Enter the room')}
        </button>

        {editing && onClose && (
          <button
            type="button"
            className="account-close"
            onClick={onClose}
            aria-label={t('关闭', 'Close')}
          >
            <ThinXIcon size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
