import { useEffect, useRef } from 'react'
import type { PresenceMember } from '../lib/chatTypes'
import { useLang } from '../lib/i18n'
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
  selfId,
  onClose,
  placement = 'top',
}: {
  members: PresenceMember[]
  selfId: string | null
  onClose: () => void
  placement?: 'top' | 'bottom'
}) {
  const lang = useLang()
  const zh = lang === 'zh'
  const popRef = useRef<HTMLDivElement>(null)

  // Click outside closes — clicks on the corner controls that own this
  // popover are their own business.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (popRef.current?.contains(target)) return
      if (target?.closest?.('.top-bar') || target?.closest?.('.settings-bar')) return
      onClose()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [onClose])

  return (
    <div
      className={`online-pop${placement === 'bottom' ? ' is-bottom' : ''}`}
      ref={popRef}
      role="dialog"
      aria-label={zh ? '在线列表' : 'Online members'}
    >
      <header className="online-pop-head">
        {zh ? `在线 · ${members.length}` : `Online · ${members.length}`}
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
            {member.userId === selfId && (
              <span className="online-pop-self">{zh ? '我' : 'you'}</span>
            )}
            <span className="online-pop-time" title={zh ? '加入时间' : 'Joined at'}>
              {formatClock(member.enteredAt)}
            </span>
          </li>
        ))}
        {members.length === 0 && (
          <li className="online-pop-empty">{zh ? '现在没有其他玩家在线' : 'Nobody else is here'}</li>
        )}
      </ul>
    </div>
  )
}

/** HH:MM:SS — join times benefit from the seconds. */
function formatClock(at: number): string {
  const d = new Date(at)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
