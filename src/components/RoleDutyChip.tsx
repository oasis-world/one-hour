import { useEffect, useState } from 'react'
import { useLang } from '../lib/i18n'
import { isHourRoleMessage, roleUntilText } from '../lib/hourRole'
import { subscribeTick } from '../lib/tick'
import './RoleDutyChip.css'

/** "值班到 HH:MM · 剩余 mm:ss" badge shown on hour-role broadcast messages. */
export default function RoleDutyChip({ authorExpiresAt }: { authorExpiresAt: number | null | undefined }) {
  const lang = useLang()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => subscribeTick(() => setNow(Date.now())), [])

  if (!isHourRoleMessage(authorExpiresAt)) return null
  const remaining = Math.max(0, (authorExpiresAt as number) - now)
  const mm = Math.floor(remaining / 60_000)
  const ss = Math.floor((remaining % 60_000) / 1000)
  const left = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  const title = lang === 'zh' || lang === 'zh-TW' ? `本小时值班 · 还剩 ${left}` : `On duty this hour · ${left} left`

  return (
    <span className="role-duty-chip" title={title}>
      <span className="role-duty-dot" aria-hidden="true" />
      {roleUntilText(authorExpiresAt as number, lang)}
      <span className="role-duty-left">{left}</span>
    </span>
  )
}
