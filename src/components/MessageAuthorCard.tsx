import { useEffect, useState } from 'react'
import type { PresenceMember } from '../lib/chatTypes'
import AvatarBadge from './AvatarBadge'

function countdown(ms: number): string {
  const seconds = Math.ceil(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function MessageAuthorCard({ member }: { member: PresenceMember }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const firstTick = window.setTimeout(() => setNow(Date.now()), 0)
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      window.clearTimeout(firstTick)
      window.clearInterval(id)
    }
  }, [])
  const remaining = now == null ? 0 : Math.max(0, (member.profileExpiresAt ?? now) - now)
  return (
    <div className="account-pop" role="status">
      <div className="account-pop-head">
        <div className="account-pop-avatar" style={{ ['--avatar-progress' as string]: String(remaining / 3_600_000) }}>
          <AvatarBadge
            look={{ style: member.avatarStyle ?? 'lorelei', seed: member.avatarSeed ?? '', url: member.avatarUrl }}
            size={52}
            className="account-pop-avatar-img"
          />
        </div>
        <div className="account-pop-id">
          <span className="account-pop-name">{member.displayName}</span>
          <span className="account-pop-role">{member.role?.trim() || '—'}</span>
          <span className="account-pop-countdown">{countdown(remaining)}</span>
        </div>
      </div>
    </div>
  )
}
