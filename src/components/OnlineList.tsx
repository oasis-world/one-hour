import { useEffect, useRef } from 'react'
import type { PresenceMember } from '../lib/chatTypes'
import { t } from '../lib/i18n'
import { suppressNextClick } from '../lib/popoverGuard'
import { userAvatarTint, userNameColor } from '../lib/identity'
import AvatarBadge from './AvatarBadge'

/**
 * Online-members popover: one row per live presence entry — DiceBear
 * face (or letter tile for peers on older clients), name (self marked),
 * and when they entered. Opens from the settings bar on small screens
 * placement flips so it grows away from the corner.
 */
export default function OnlineList({
  members,
  onClose,
  placement = 'top',
}: {
  members: PresenceMember[]
  onClose: () => void
  placement?: 'top' | 'bottom'
}) {
  const popRef = useRef<HTMLDivElement>(null)

  // Click outside closes — clicks on the corner controls that own this
  // popover are their own business.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (popRef.current?.contains(target)) return
      if (target?.closest?.('.top-bar') || target?.closest?.('.settings-bar')) return
      suppressNextClick()
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [onClose])

  return (
    <div
      className={`online-pop${placement === 'bottom' ? ' is-bottom' : ''}`}
      ref={popRef}
      role="dialog"
      aria-label={t('在线列表', 'Online members')}
    >
      <header className="online-pop-head">
        <span>{`${t('在线', 'Online')} · ${members.length}`}</span>
      </header>
      <ul className="online-pop-list">
        {members.map((member) => (
          <li key={member.userId} className="online-pop-row">
            {member.avatarUrl || (member.avatarStyle && member.avatarSeed) ? (
              <AvatarBadge
                look={{
                  style: member.avatarStyle ?? 'lorelei',
                  seed: member.avatarSeed ?? '',
                  url: member.avatarUrl || null,
                }}
                size={28}
                className="online-pop-face"
              />
            ) : (
              <span
                className="online-pop-avatar"
                style={{ background: userAvatarTint(member.userId) }}
              >
                {member.displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="online-pop-name" style={{ color: userNameColor(member.userId) }}>
              {member.displayName}
            </span>
          </li>
        ))}
        {members.length === 0 && (
          <li className="online-pop-empty">{t('现在没有其他玩家在线', 'Nobody else is here')}</li>
        )}
      </ul>
    </div>
  )
}
