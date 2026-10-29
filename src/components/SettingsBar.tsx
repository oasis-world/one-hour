import { useEffect, useRef, useState } from 'react'
import type { PresenceMember } from '../lib/chatTypes'
import type { ThemeName } from '../lib/settings'
import { COUNTDOWN_ANIMATIONS, type CountdownAnimation } from '../lib/countdownAnimations'
import { useLang, LANG_LABELS, t } from '../lib/i18n'
import { setPopoverOpen } from '../lib/popoverGuard'
import { ChevronRightIcon, MoonIcon, SunIcon } from './icons'
import { AnimationIcon, GearIcon, GlobeIcon, RefreshIcon } from './userIcons'
import CountdownAnimationPicker from './CountdownAnimationPicker'
import LanguagePicker from './LanguagePicker'
import OnlineList from './OnlineList'
import OnlineTrigger from './OnlineTrigger'

export default function SettingsBar({
  members,
  theme,
  countdownAnimation,
  suppressed = false,
  onToggleTheme,
  onChangeCountdownAnimation,
}: {
  members: PresenceMember[]
  theme: ThemeName
  countdownAnimation: CountdownAnimation
  /** Composer popover is up — mobile hides the gear meanwhile. */
  suppressed?: boolean
  onToggleTheme: () => void
  onChangeCountdownAnimation: (animation: CountdownAnimation) => void
}) {
  const lang = useLang()
  const mobile = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const [open, setOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [subview, setSubview] = useState<'language' | 'animation' | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const anyOpen = open || listOpen || subview !== null
  const currentAnimation = COUNTDOWN_ANIMATIONS.find((option) => option.id === countdownAnimation)

  // Report to the chat-stage fold guard so a blank click that dismisses
  // these popovers doesn't also fold the chat (see popoverGuard.ts).
  useEffect(() => {
    if (!anyOpen) return
    setPopoverOpen(true)
    return () => setPopoverOpen(false)
  }, [anyOpen])

  // Clicks anywhere outside the corner (popovers included via the ref)
  // fold both layers back down.
  useEffect(() => {
    if (!anyOpen) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (barRef.current?.contains(target)) return
      if (target?.closest?.('.online-pop')) return
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      setOpen(false)
      setListOpen(false)
      setSubview(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setListOpen(false)
        setSubview(null)
      }
    }
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [anyOpen])

  return (
    <>
    {anyOpen && (
      <div
        className="settings-dismiss-layer"
        aria-hidden="true"
        onPointerDown={() => {
          setOpen(false)
          setListOpen(false)
          setSubview(null)
        }}
      />
    )}
    <div
      className={`settings-bar${suppressed ? ' is-suppressed' : ''}`}
      ref={barRef}
    >
      <button
        type="button"
        className="settings-btn"
        onClick={() => {
          setOpen((v) => !v)
          setListOpen(false)
          setSubview(null)
        }}
        aria-label={t('设置', 'Settings')}
        title={t('设置', 'Settings')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <GearIcon size={15} />
      </button>

      <OnlineTrigger
        members={members}
        open={listOpen}
        onClick={() => {
          setListOpen((value) => !value)
          setOpen(false)
          setSubview(null)
        }}
      />

      {open && !listOpen && !subview && (
        <div className="settings-pop" role="menu" aria-label={t('设置', 'Settings')}>
          <button
            type="button"
            className="settings-row"
            role="menuitem"
            onClick={() => setSubview('language')}
            title={t('切换语言', 'Switch language')}
          >
            <span className="settings-row-icon"><GlobeIcon size={15} /></span>
            <span className="settings-row-label">{t('语言', 'Language')}</span>
            <span className="settings-row-value">{LANG_LABELS[lang]}</span>
            <ChevronRightIcon size={14} />
          </button>

          <button
            type="button"
            className="settings-row"
            role="menuitem"
            onClick={() => setSubview('animation')}
            title={t('选择倒计时动画', 'Choose countdown animation')}
          >
            <span className="settings-row-icon"><AnimationIcon size={15} /></span>
            <span className="settings-row-label">{t('动画', 'Animation')}</span>
            <span className="settings-row-value settings-current-animation">
              {currentAnimation ? t(currentAnimation.zh, currentAnimation.en) : ''}
            </span>
            <ChevronRightIcon size={14} />
          </button>

          <button
            type="button"
            className="settings-row"
            role="menuitem"
            onClick={onToggleTheme}
            title={t('切换主题', 'Switch theme')}
          >
            <span className="settings-row-icon">
              {theme === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />}
            </span>
            <span className="settings-row-label">{t('主题', 'Theme')}</span>
            <span className="settings-row-value">
              {theme === 'dark' ? (t('深色', 'Dark')) : t('暖色', 'Warm')}
            </span>
          </button>

          {mobile && (
            <button
              type="button"
              className="settings-row"
              role="menuitem"
              onClick={() => window.location.reload()}
            >
              <span className="settings-row-icon"><RefreshIcon size={15} /></span>
              <span className="settings-row-label">{t('刷新页面', 'Reload page')}</span>
            </button>
          )}
        </div>
      )}

      {open && subview === 'language' && (
        <LanguagePicker
          selected={lang}
          onSelect={() => setSubview(null)}
          onBack={() => setSubview(null)}
        />
      )}

      {open && subview === 'animation' && (
        <CountdownAnimationPicker
          selected={countdownAnimation}
          onSelect={onChangeCountdownAnimation}
          onBack={() => setSubview(null)}
        />
      )}
      {listOpen && (
        <OnlineList
          members={members}
          placement="bottom"
          onClose={() => setListOpen(false)}
        />
      )}
    </div>
    </>
  )
}
