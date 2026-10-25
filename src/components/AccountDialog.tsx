import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  bindEmail,
  signInWithPassword,
  signOutAccount,
  isSupabaseConfigured,
  type AccountState,
  type AuthErrorKind,
} from '../lib/account'
import { useLang } from '../lib/i18n'
import { useImeEnter } from '../lib/ime'
import { ThinXIcon } from './icons'
import { UserIcon } from './userIcons'

/**
 * Login / register modal, ported from the oasis-game AccountDialog: guests
 * bind an email onto their anonymous identity (same user id — messages are
 * never orphaned), returning players sign in. Enter walks the fields.
 */

type FeedbackCode = AuthErrorKind | 'empty-email' | 'empty-password' | 'mismatch'
type Feedback = { kind: 'error'; code: FeedbackCode } | { kind: 'bound' } | null

const ERROR_TEXT: Record<FeedbackCode, [zh: string, en: string]> = {
  'invalid-input': ['请输入有效邮箱和至少 6 位密码。', 'Enter a valid email and a password of at least 6 characters.'],
  network: ['网络不可用，请稍后再试。', 'Network unavailable — try again later.'],
  'invalid-credentials': ['邮箱或密码不正确。', 'Wrong email or password.'],
  'email-unconfirmed': ['邮箱尚未验证，请先查收确认邮件。', 'Email not verified yet — check your inbox for the confirmation link.'],
  'email-taken': ['该邮箱已注册，请直接登录。', 'That email is already registered — sign in instead.'],
  'weak-password': ['密码太弱，请至少使用 6 位。', 'Password too weak — use at least 6 characters.'],
  'rate-limited': ['操作太频繁，请稍等片刻再试。', 'Too many requests — wait a moment and try again.'],
  unknown: ['操作失败，请稍后再试。', 'Something went wrong — try again later.'],
  'empty-email': ['请输入邮箱。', 'Enter your email.'],
  'empty-password': ['请输入密码。', 'Enter your password.'],
  mismatch: ['两次输入的密码不一致。', 'Passwords do not match.'],
}

export default function AccountDialog({
  account,
  onClose,
  onOpenProfile,
  initialMode = 'bind',
}: {
  account: AccountState
  onClose: () => void
  onOpenProfile?: () => void
  /** 'signin' opens straight on the sign-in form (popover entry). */
  initialMode?: 'bind' | 'signin'
}) {
  const lang = useLang()
  const zh = lang === 'zh'
  const configured = isSupabaseConfigured()
  const [mode, setMode] = useState<'bind' | 'signin'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const ime = useImeEnter()
  const [feedback, setFeedback] = useState<Feedback>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const signOut = async () => {
    setBusy(true)
    await signOutAccount()
    setBusy(false)
  }

  const validEmail = (value: string) => value.includes('@')

  const submit = async () => {
    if (busy) return
    const clean = email.trim()
    if (!clean || !validEmail(clean)) {
      setFeedback({ kind: 'error', code: clean ? 'invalid-input' : 'empty-email' })
      return
    }
    if (!password) {
      setFeedback({ kind: 'error', code: 'empty-password' })
      return
    }
    if (password.length < 6) {
      setFeedback({ kind: 'error', code: 'weak-password' })
      return
    }
    if (mode === 'bind' && password !== confirm) {
      setFeedback({ kind: 'error', code: 'mismatch' })
      return
    }
    setBusy(true)
    setFeedback(null)
    const res =
      mode === 'bind'
        ? await bindEmail(clean, password)
        : await signInWithPassword(clean, password)
    setBusy(false)
    if (!res.ok) {
      setFeedback({ kind: 'error', code: res.error ?? 'unknown' })
      return
    }
    if (mode === 'bind' && res.pendingVerification) {
      setFeedback({ kind: 'bound' })
      return
    }
    onClose()
  }

  /** Enter walks field → field → submit. IME composition Enter is the
   *  candidates' commit — it must never walk or submit. */
  const onFieldEnter = (field: 'email' | 'password' | 'confirm') =>
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (ime.imeConsumesEnter(e)) return
      if (e.key !== 'Enter') return
      e.preventDefault()
      if (field === 'email') {
        if (!validEmail(email.trim())) {
          setFeedback({ kind: 'error', code: 'empty-email' })
          return
        }
        passwordRef.current?.focus()
        return
      }
      if (field === 'password') {
        if (!password) {
          setFeedback({ kind: 'error', code: 'empty-password' })
          return
        }
        if (mode === 'bind') {
          confirmRef.current?.focus()
          return
        }
        void submit()
        return
      }
      if (!confirm) {
        setFeedback({ kind: 'error', code: 'empty-password' })
        return
      }
      void submit()
    }

  const title = mode === 'bind' ? (zh ? '注册' : 'Sign Up') : zh ? '登录' : 'Sign In'
  const feedbackText = (code: FeedbackCode) => {
    const [z, e] = ERROR_TEXT[code]
    return zh ? z : e
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="account-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header style={{ display: 'flex', alignItems: 'center' }}>
          <h3 className="account-title">{title}</h3>
        </header>
        <button
          type="button"
          className="account-close"
          onClick={onClose}
          aria-label={zh ? '关闭' : 'Close'}
        >
          <ThinXIcon size={15} />
        </button>
        <div className="account-body">
          {account.status === 'signedIn' ? (
            <>
              <p className="account-status">
                {zh ? '已登录' : 'Signed in'} · {account.email}
              </p>
              <div className="account-actions">
                {onOpenProfile && (
                  <button
                    type="button"
                    className="btn-ghost account-profile-btn"
                    disabled={busy}
                    onClick={onOpenProfile}
                  >
                    <UserIcon size={15} />
                    {zh ? '个人资料' : 'Profile'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn-ghost danger-text"
                  disabled={busy}
                  onClick={signOut}
                >
                  {zh ? '退出登录' : 'Sign out'}
                </button>
              </div>
            </>
          ) : configured ? (
            <>
              <div className="account-fields">
                <label className="field">
                  <span>{zh ? '邮箱' : 'Email'}</span>
                  <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    autoComplete="email"
                    autoFocus
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={onFieldEnter('email')}
                    {...ime.imeProps}
                  />
                </label>
                <label className="field">
                  <span>{zh ? '密码' : 'Password'}</span>
                  <input
                    ref={passwordRef}
                    type="password"
                    value={password}
                    autoComplete={mode === 'bind' ? 'new-password' : 'current-password'}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={onFieldEnter('password')}
                    {...ime.imeProps}
                  />
                </label>
                {mode === 'bind' && (
                  <label className="field">
                    <span>{zh ? '确认密码' : 'Confirm password'}</span>
                    <input
                      ref={confirmRef}
                      type="password"
                      value={confirm}
                      autoComplete="new-password"
                      onChange={(e) => setConfirm(e.target.value)}
                      onKeyDown={onFieldEnter('confirm')}
                      {...ime.imeProps}
                    />
                  </label>
                )}
              </div>
              {feedback?.kind === 'error' && (
                <p className="account-feedback is-error">{feedbackText(feedback.code)}</p>
              )}
              {feedback?.kind === 'bound' && (
                <p className="account-feedback is-ok">
                  {zh
                    ? '确认邮件已发送，点击邮件中的链接后正式生效。'
                    : 'Confirmation email sent — follow the link inside to finish.'}
                </p>
              )}
              <div className="account-actions">
                <button type="button" className="btn-accent" disabled={busy} onClick={submit}>
                  {title}
                </button>
              </div>
              <button
                type="button"
                className="account-switch"
                onClick={() => {
                  setMode(mode === 'bind' ? 'signin' : 'bind')
                  setFeedback(null)
                }}
              >
                {mode === 'bind'
                  ? zh
                    ? '已有账号？直接登录'
                    : 'Have an account? Sign in'
                  : zh
                    ? '注册新账号'
                    : 'Create an account'}
              </button>
              <p className="account-status is-bottom">
                {zh
                  ? '注册并登录后身份处处可用；未登录则为旅人身份，仅保存在本机。'
                  : 'With an account your identity works everywhere; without one you stay a Traveler, saved on this device only.'}
              </p>
            </>
          ) : (
            <p className="account-status">
              {zh
                ? '同步服务未配置 · 聊天仅保存在本机'
                : 'Sync not configured · chat stays on this device'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
