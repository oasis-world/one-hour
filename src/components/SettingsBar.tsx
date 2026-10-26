import { useEffect, useRef, useState } from 'react'
import type { PresenceMember } from '../lib/chatTypes'
import type { ThemeName } from '../lib/settings'
import { useLang, setLang, LANGS, LANG_LABELS, t } from '../lib/i18n'
import { useHoverCapable } from '../lib/media'
import { useHoverReveal } from '../lib/useHoverReveal'
import { ChevronRightIcon, MoonIcon, PeopleIcon, SunIcon } from './icons'
import { GearIcon, GlobeIcon, RefreshIcon } from './userIcons'
import OnlineList from './OnlineList'

/**
 * Bottom-left corner: the settings gear. Hover (desktop) or click opens
 * the room switches — online count (opens the member list), theme,
 * language.
 */
export default function SettingsBar({
  members,
  selfId,
  theme,
  suppressed = false,
  onToggleTheme,
}: {
  members: PresenceMember[]
  selfId: string | null
  theme: ThemeName
  /** Composer popover is up — mobile hides the gear meanwhile. */
  suppressed?: boolean
  onToggleTheme: () => void
}) {
  const lang = useLang()
  const zh = lang === 'zh'
  const mobile = (() => {
    try {
      return window.matchMedia('(pointer: coarse)').matches
    } catch {
      return false
    }
  })()
  const [open, setOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)
  const hover = useHoverCapable()
  const { onEnter, onLeave } = useHoverReveal(
    hover,
    () => {
      // Hovering back in while the member list is up keeps it as-is.
      setOpen((v) => (v || listOpen ? v : true))
    },
    () => {
      setOpen(false)
      setListOpen(false)
    },
  )

  // Clicks anywhere outside the corner (popovers included via the ref)
  // fold both layers back down.
  useEffect(() => {
    if (!open && !listOpen && !langOpen) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (barRef.current?.contains(target)) return
      if (target?.closest?.('.online-pop')) return
      setOpen(false)
      setListOpen(false)
      setLangOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setListOpen(false)
        setLangOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, listOpen, langOpen])

  const onlineLabel = zh ? `在线 · ${members.length} 人` : `Online · ${members.length}`

  return (
    <div
      className={`settings-bar${suppressed ? ' is-suppressed' : ''}`}
      ref={barRef}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <button
        type="button"
        className="settings-btn"
        onClick={() => {
          setOpen((v) => !v)
          setListOpen(false)
        }}
        aria-label={t('设置', 'Settings')}
        title={t('设置', 'Settings')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <GearIcon size={15} />
      </button>

      {open && !listOpen && !langOpen && (
        <div className="settings-pop" role="menu" aria-label={t('设置', 'Settings')}>
          <button
            type="button"
            className="settings-row"
            role="menuitem"
            onClick={() => setLangOpen(true)}
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
            aria-expanded={listOpen}
            onClick={() => {
              setListOpen(true)
              setOpen(false)
            }}
          >
            <span className="settings-row-icon is-ok"><PeopleIcon size={15} /></span>
            <span className="settings-row-label">{onlineLabel}</span>
            <ChevronRightIcon size={14} />
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
        </div>
      )}

      {open && langOpen && (
        <div className="settings-pop" role="menu" aria-label={t('语言', 'Language')}>
          {LANGS.map((code) => (
            <button
              key={code}
              type="button"
              className={`settings-row${code === lang ? ' is-current' : ''}`}
              role="menuitem"
              onClick={() => {
                setLang(code)
                setLangOpen(false)
              }}
            >
              <span className="settings-row-icon"><GlobeIcon size={15} /></span>
              <span className="settings-row-label">{LANG_LABELS[code]}</span>
              {code === lang && <span className="settings-row-value">✓</span>}
            </button>
          ))}
        </div>
      )}

      {listOpen && (
        <OnlineList
          members={members}
          selfId={selfId}
          placement="bottom"
          onClose={() => setListOpen(false)}
        />
      )}
    </div>
  )
}
