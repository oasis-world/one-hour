import { useEffect, useRef } from 'react'
import type { PresenceMember } from '../lib/chatTypes'
import { useLang } from '../lib/i18n'
import { isAutoTravelerName } from '../lib/nickname'
import { userAvatarTint, userNameColor } from '../lib/identity'
import { TravelerGlyph } from './icons'

/**
 * Online-members popover, opened from the people chip in the top bar:
 * one row per live presence entry — avatar tile, name (self marked),
 * and when they entered. Makes the online count verifiable at a glance.
 */
export default function OnlineList({
  members,
  selfId,
  onClose,
}: {
  members: PresenceMember[]
  selfId: string | null
  onClose: () => void
}) {
  const lang = useLang()
  const zh = lang === 'zh'
  const popRef = useRef<HTMLDivElement>(null)

  // Click outside closes — clicks on the top bar itself are the toggle
  // chip's business, not ours.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (popRef.current?.contains(target)) return
      if (target?.closest?.('.top-bar')) return
      onClose()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [onClose])

  return (
    <div className="online-pop" ref={popRef} role="dialog" aria-label={zh ? '在线列表' : 'Online members'}>
      <header className="online-pop-head">
        {zh ? `在线 · ${members.length}` : `Online · ${members.length}`}
      </header>
      <ul className="online-pop-list">
        {members.map((member) => (
          <li key={member.userId} className="online-pop-row">
            <span
              className="online-pop-avatar"
              style={{ background: userAvatarTint(member.userId) }}
            >
              {isAutoTravelerName(member.displayName) ? (
                <TravelerGlyph size={14} />
              ) : (
                member.displayName.slice(0, 1).toUpperCase()
              )}
            </span>
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
