import { useEffect, useState } from 'react'
import type { PresenceMember } from '../lib/chatTypes'
import { fetchCloudProfile } from '../lib/profileCloud'
import type { CloudProfileSnapshot } from '../lib/profileCloud'
import AvatarBadge from './AvatarBadge'

function countdown(ms: number): string {
  const seconds = Math.ceil(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function MessageAuthorCard({ member, className }: { member: PresenceMember; className?: string }) {
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
  const expiresAt = cloudProfile?.expiresAt ?? member.profileExpiresAt
  const remaining = now == null ? 0 : Math.max(0, (expiresAt ?? now) - now)
  return (
    <div className={`account-pop${className ? ` ${className}` : ''}`} role="status">
      <div className="account-pop-head">
        <div className="account-pop-avatar" style={{ ['--avatar-progress' as string]: String(remaining / 3_600_000) }}>
          <AvatarBadge
            look={profile}
            size={52}
            className="account-pop-avatar-img"
          />
        </div>
        <div className="account-pop-id">
          <span className="account-pop-name">{profile.nickname}</span>
          <span className="account-pop-role">{profile.role?.trim() || '—'}</span>
          <span className="account-pop-countdown">{countdown(remaining)}</span>
        </div>
      </div>
    </div>
  )
}
