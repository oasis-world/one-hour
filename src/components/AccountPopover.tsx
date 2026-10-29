import { useEffect, useRef, useState } from 'react'
// EXPERIMENT: sign-in / sign-out disabled.
// import { signOutAccount, type AccountState } from '../lib/account'
import type { AccountState } from '../lib/account'
import { getProfileExpiresAt } from '../lib/userProfile'
import { useLang } from '../lib/i18n'
import type { Lang } from '../lib/i18n'
import type { UserProfile } from '../lib/userProfile'
import { suppressNextClick } from '../lib/popoverGuard'
import AvatarBadge from './AvatarBadge'
// EXPERIMENT: icon imports unused while actions disabled.
// import { RefreshIcon, SignOutIcon, UserIcon } from './userIcons'

const STR: Record<string, Record<Lang, string>> = {
  account: { zh: '账号', 'zh-TW': '帳號', en: 'Account', ja: 'アカウント', fr: 'Compte', es: 'Cuenta', de: 'Konto', ko: '계정', it: 'Account', ar: 'الحساب' },
  traveler: { zh: '旅人', 'zh-TW': '旅人', en: 'Traveler', ja: '旅人', fr: 'Voyageur', es: 'Viajero', de: 'Reisender', ko: '여행자', it: 'Viaggiatore', ar: 'مسافر' },
  synced: { zh: '已同步云端', 'zh-TW': '已同步雲端', en: 'synced to cloud', ja: 'クラウド同期済み', fr: 'synchronisé', es: 'sincronizado', de: 'synchronisiert', ko: '클라우드 동기화됨', it: 'sincronizzato', ar: 'متزامن' },
  travelerLocal: { zh: '旅人身份 · 仅保存在本机', 'zh-TW': '旅人身份 · 僅保存在本機', en: 'Traveler · saved on this device only', ja: '旅人 · この端末にのみ保存', fr: 'Voyageur · enregistré sur cet appareil', es: 'Viajero · guardado en este dispositivo', de: 'Reisender · nur auf diesem Gerät', ko: '여행자 · 이 기기에만 저장', it: 'Viaggiatore · salvato su questo dispositivo', ar: 'مسافر · محفوظ على هذا الجهاز' },
  signOutConfirm: { zh: '确定要退出登录吗？', 'zh-TW': '確定要退出登入嗎？', en: 'Sign out of this device?', ja: 'この端末からサインアウトしますか？', fr: 'Se déconnecter de cet appareil ?', es: '¿Cerrar sesión en este dispositivo?', de: 'Von diesem Gerät abmelden?', ko: '이 기기에서 로그아웃할까요?', it: 'Disconnettersi da questo dispositivo?', ar: 'تسجيل الخروج من هذا الجهاز؟' },
  cancel: { zh: '取消', 'zh-TW': '取消', en: 'Cancel', ja: 'キャンセル', fr: 'Annuler', es: 'Cancelar', de: 'Abbrechen', ko: '취소', it: 'Annulla', ar: 'إلغاء' },
  signOut: { zh: '退出登录', 'zh-TW': '退出登入', en: 'Sign out', ja: 'サインアウト', fr: 'Déconnexion', es: 'Cerrar sesión', de: 'Abmelden', ko: '로그아웃', it: 'Esci', ar: 'تسجيل خروج' },
  profile: { zh: '个人资料', 'zh-TW': '個人資料', en: 'Profile', ja: 'プロフィール', fr: 'Profil', es: 'Perfil', de: 'Profil', ko: '프로필', it: 'Profilo', ar: 'الملف الشخصي' },
  newAvatar: { zh: '换个头像和昵称', 'zh-TW': '換個頭像和暱稱', en: 'New avatar & nickname', ja: 'アバターと名前を変更', fr: 'Nouvel avatar et pseudo', es: 'Nuevo avatar y apodo', de: 'Neuer Avatar & Name', ko: '아바타와 닉네임 변경', it: 'Nuovo avatar e nome', ar: 'صورة واسم جديدين' },
  signIn: { zh: '登录', 'zh-TW': '登入', en: 'Sign in', ja: 'サインイン', fr: 'Connexion', es: 'Iniciar sesión', de: 'Anmelden', ko: '로그인', it: 'Accedi', ar: 'تسجيل دخول' },
}

function L(lang: Lang, key: string): string {
  return STR[key]?.[lang] ?? STR[key]?.en ?? key
}

/**
 * Menu behind the top-left avatar: who you are (nickname + identity
 * line), then either the sign-in entry for travelers or the profile page
 * and sign-out actions for signed-in players.
 */
export default function AccountPopover({
  profile,
  onClose,
}: {
  account?: AccountState
  profile: UserProfile | null
  onClose: () => void
  // EXPERIMENT: sign-in / sign-out / profile edit disabled.
  onSignIn?: () => void
  onOpenProfile?: () => void
  onOpenWelcome?: () => void
}) {
  const lang = useLang()
  const popRef = useRef<HTMLDivElement>(null)
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
  const formatCountdown = (ms: number) => {
    const total = Math.ceil(ms / 1000)
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    // Clicks on the top bar itself belong to the avatar toggle.
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (popRef.current?.contains(target)) return
      if (target?.closest?.('.top-bar')) return
      if (target?.closest?.('.chat-top-avatar')) return
      suppressNextClick()
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // EXPERIMENT: unused while actions disabled.
  // const act = (fn: () => void) => () => {
  //   onClose()
  //   fn()
  // }

  // EXPERIMENT: sign-out disabled.
  // const signOut = act(() => {
  //   void signOutAccount()
  // })

  return (
    <div className="account-pop" ref={popRef} role="menu" aria-label={L(lang, 'account')}>
      <div className="account-pop-head">
        <div
          className="account-pop-avatar"
          style={{ ['--avatar-progress' as string]: String(progress) }}
        >
          <AvatarBadge look={profile} size={52} className="account-pop-avatar-img" />
        </div>
        <div className="account-pop-id">
          <span className="account-pop-name">
            {profile?.nickname ?? L(lang, 'traveler')}
          </span>
          <span className="account-pop-role">
            {profile?.role && profile.role.trim() ? profile.role : '—'}
          </span>
          <span className="account-pop-countdown">
            {formatCountdown(remainingMs)}
          </span>
        </div>
      </div>

      {/* EXPERIMENT: sign-in / sign-out / profile edit / new avatar disabled.
      <div className="account-pop-actions">
        ... (disabled)
      </div> */}
    </div>
  )
}
