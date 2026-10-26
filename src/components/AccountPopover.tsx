import { useEffect, useRef, useState } from 'react'
import { signOutAccount, type AccountState } from '../lib/account'
import { useLang } from '../lib/i18n'
import type { Lang } from '../lib/i18n'
import type { UserProfile } from '../lib/userProfile'
import AvatarBadge from './AvatarBadge'
import { RefreshIcon, SignOutIcon, UserIcon } from './userIcons'

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
    <div className="account-pop" ref={popRef} role="menu" aria-label={L(lang, 'account')}>
      <div className="account-pop-head">
        <AvatarBadge look={profile} size={52} />
        <div className="account-pop-id">
          <span className="account-pop-name">
            {profile?.nickname ?? L(lang, 'traveler')}
          </span>
          <span className="account-pop-sub">
            {signedIn
              ? `${account.email ?? ''} · ${L(lang, 'synced')}`
              : L(lang, 'travelerLocal')}
          </span>
        </div>
      </div>

      <div className="account-pop-actions">
        {signedIn ? (
          confirmingOut ? (
            <>
              <p className="account-pop-confirm">
                {L(lang, 'signOutConfirm')}
              </p>
              <div className="account-pop-confirm-row">
                <button
                  type="button"
                  className="account-pop-item"
                  role="menuitem"
                  onClick={() => setConfirmingOut(false)}
                >
                  {L(lang, 'cancel')}
                </button>
                <button
                  type="button"
                  className="account-pop-item is-danger"
                  role="menuitem"
                  onClick={signOut}
                >
                  {L(lang, 'signOut')}
                </button>
              </div>
            </>
          ) : (
            <>
              <button type="button" className="account-pop-item" role="menuitem" onClick={act(onOpenProfile)}>
                <UserIcon size={15} />
                {L(lang, 'profile')}
              </button>
              <button type="button" className="account-pop-item is-danger" role="menuitem" onClick={() => setConfirmingOut(true)}>
                <SignOutIcon size={15} />
                {L(lang, 'signOut')}
              </button>
            </>
          )
        ) : (
          <>
            <button type="button" className="account-pop-item" role="menuitem" onClick={act(onOpenWelcome)}>
              <RefreshIcon size={15} />
              {L(lang, 'newAvatar')}
            </button>
            <button type="button" className="account-pop-item" role="menuitem" onClick={act(onSignIn)}>
              <UserIcon size={15} />
              {L(lang, 'signIn')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
