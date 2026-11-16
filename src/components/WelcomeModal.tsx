import { useEffect, useRef, useState, type FocusEvent as ReactFocusEvent, type FormEvent as ReactFormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
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
import { generateCompanionProfile, loadCompanionProfile, saveCompanionProfile } from '../lib/companionProfile'
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
  // One hook per field: a lost IME composition in one must never swallow
  // Enter in the other.
  const nickIme = useImeEnter()
  const roleIme = useImeEnter()
  const nicknameRef = useRef<HTMLInputElement>(null)
  const roleRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
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

  /** Pan the scrollable backdrop so the focused field rides above the keyboard. */
  const ensureFieldVisible = (el: HTMLElement, instant = false) => {
    try {
      el.scrollIntoView({ block: 'center', behavior: instant ? 'auto' : 'smooth' })
    } catch { /* noop */ }
  }

  const onFieldFocus = (e: ReactFocusEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    // The keyboard animates in over ~300ms, so the first scroll (taken
    // while the layout still spans the full screen) strands the lower
    // field under the keys. Retry after it settles; the visualViewport
    // effect below glues the field through the animation itself.
    window.setTimeout(() => ensureFieldVisible(el), 300)
    window.setTimeout(() => {
      if (document.activeElement === el) ensureFieldVisible(el)
    }, 650)
  }

  // Glue the focused field above the keyboard while the visual viewport
  // resizes/scrolls through the keyboard animation. Instant scroll:
  // smooth would fight the viewport motion and lag one frame behind.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    try {
      if (!window.matchMedia('(pointer: coarse)').matches) return
    } catch { /* noop */ }
    const onVv = () => {
      const active = document.activeElement
      if (
        active instanceof HTMLElement &&
        (active === nicknameRef.current || active === roleRef.current)
      ) {
        ensureFieldVisible(active, true)
      }
    }
    vv.addEventListener('resize', onVv)
    vv.addEventListener('scroll', onVv)
    return () => {
      vv.removeEventListener('resize', onVv)
      vv.removeEventListener('scroll', onVv)
    }
  }, [])

  const reroll = () => {
    setDraft((prev) => randomProfile(prev, lang))
  }

  const confirm = () => {
    const nickname = cleanNickname(draft.nickname)
    const role = cleanRole(draft.role ?? '')
    if (!nickname) {
      setError(t('请输入昵称', 'Nickname is required'))
      nicknameRef.current?.focus()
      return
    }
    if (!role) {
      setError(t('请输入角色', 'Role is required'))
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
    const expiresAt = Date.now() + PROFILE_LIFETIME_MS
    setProfileExpiresAt(expiresAt)
    // Companion lives alongside the profile — create/refresh on every confirm.
    // Keep existing companion in edit mode to preserve private history.
    const existingCompanion = loadCompanionProfile()
    const shouldRecreate = mode !== 'edit' || !existingCompanion || existingCompanion.expiresAt <= Date.now()
    if (shouldRecreate) {
      const companion = generateCompanionProfile(nickname, role, { lang, expiresAt })
      saveCompanionProfile(companion)
    } else if (existingCompanion) {
      saveCompanionProfile({ ...existingCompanion, expiresAt })
    }
    // Returning player with a live session: the pick belongs in the cloud.
    // Anonymous users also persist their profile + expiry for refresh sync.
    if (account.status === 'signedIn' || account.status === 'anonymous') void pushProfileToCloud()
    onClose?.()
  }

  const handleSubmit = (e: ReactFormEvent<HTMLFormElement>) => {
    e.preventDefault()
    confirm()
  }

  const onNickEnter = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (nickIme.imeConsumesEnter(e)) return
    if (e.key !== 'Enter') return
    e.preventDefault() // advancing must not submit the form
    // First Enter advances to the role field; a second one confirms.
    roleRef.current?.focus()
  }

  const onRoleEnter = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (roleIme.imeConsumesEnter(e)) return
    if (e.key !== 'Enter') return
    e.preventDefault()
    // Desktop/Android: request submit. iOS: the Go key submits the form
    // directly via handleSubmit without ever firing this keydown.
    if (typeof formRef.current?.requestSubmit === 'function') formRef.current.requestSubmit()
    else confirm()
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
          allowPickStyle={false}
          onReroll={reroll}
          onUploaded={(url) => setDraft((prev) => ({ ...prev, avatarUrl: url }))}
        />

        <form ref={formRef} className="welcome-form" onSubmit={handleSubmit}>
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
                  enterKeyHint="next"
                  autoFocus={typeof window !== 'undefined' && !window.matchMedia('(pointer: coarse)').matches}
                  onChange={(e) => {
                    setDraft({ ...draft, nickname: e.target.value })
                    setError(null)
                  }}
                  onFocus={onFieldFocus}
                  onBlur={nickIme.resetIme}
                  onKeyDown={onNickEnter}
                  {...nickIme.imeProps}
                />
                {draft.nickname && (
                  <button
                    type="button"
                    className="field-clear"
                    aria-label={t('清空', 'Clear')}
                    tabIndex={-1}
                    onPointerDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
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
                  enterKeyHint={editing ? 'done' : 'go'}
                  onChange={(e) => {
                    setDraft({ ...draft, role: e.target.value })
                    setError(null)
                  }}
                  onFocus={onFieldFocus}
                  onBlur={roleIme.resetIme}
                  onKeyDown={onRoleEnter}
                  {...roleIme.imeProps}
                />
                {draft.role && (
                  <button
                    type="button"
                    className="field-clear"
                    aria-label={t('清空', 'Clear')}
                    tabIndex={-1}
                    onPointerDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
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
          <button type="submit" className="btn-accent welcome-confirm">
            {editing ? (t('保存', 'Save')) : t('开始聊天', 'Enter the room')}
          </button>
        </form>

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
