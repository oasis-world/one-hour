import { useEffect, useState } from 'react'
import type { PresenceMember } from '../lib/chatTypes'
import { fetchCloudProfile } from '../lib/profileCloud'
import type { CloudProfileSnapshot } from '../lib/profileCloud'
import AvatarBadge from './AvatarBadge'

function countdown(ms: number): string {
  const seconds = Math.ceil(ms / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export default function MessageAuthorCard({
  member,
  className,
  expired = false,
}: {
  member: PresenceMember
  className?: string
  expired?: boolean
}) {
  const [now, setNow] = useState<number | null>(null)
  const [cloudProfile, setCloudProfile] = useState<CloudProfileSnapshot | null>(null)
  useEffect(() => {
    const firstTick = window.setTimeout(() => setNow(Date.now()), 0)
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      window.clearTimeout(firstTick)
      window.clearInterval(id)
    }
  }, [])
  useEffect(() => {
    let active = true
    void fetchCloudProfile(member.userId).then((snapshot) => {
      if (active && snapshot) setCloudProfile(snapshot)
    })
    return () => { active = false }
  }, [member.userId])
  const profile = cloudProfile?.profile ?? {
    nickname: member.displayName,
    role: member.role ?? '',
    style: member.avatarStyle ?? 'lorelei',
    seed: member.avatarSeed ?? '',
    avatarUrl: member.avatarUrl,
  }
  const role = cloudProfile?.profile.role?.trim() || member.role?.trim() || ''
  const expiresAt = cloudProfile?.expiresAt ?? member.profileExpiresAt
  const remaining = expired || now == null ? 0 : Math.max(0, (expiresAt ?? now) - now)
  return (
    <div className={`account-pop${className ? ` ${className}` : ''}`} role="status">
      <div className="account-pop-head">
        <div
          className={`account-pop-avatar${expired ? ' is-expired' : ''}`}
          style={{ ['--avatar-progress' as string]: String(remaining / 3_600_000) }}
        >
          <AvatarBadge
            look={profile}
            size={52}
            className="account-pop-avatar-img"
          />
        </div>
        <div className="account-pop-id">
          <span className="account-pop-name">{profile.nickname}</span>
          {role && <span className="account-pop-role">{role}</span>}
          <span className="account-pop-countdown">{countdown(remaining)}</span>
        </div>
      </div>
    </div>
  )
}
