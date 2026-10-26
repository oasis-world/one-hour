import type { PresenceMember } from '../lib/chatTypes'
import { t } from '../lib/i18n'
import { PeopleIcon } from './icons'

export default function OnlineTrigger({
  members,
  open,
  onClick,
}: {
  members: PresenceMember[]
  open: boolean
  onClick: () => void
}) {
  const label = `${t('在线', 'Online')} · ${members.length}`
  return (
    <button
      type="button"
      className="settings-btn settings-online-btn"
      aria-label={label}
      title={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onClick}
    >
      <PeopleIcon size={15} />
      <span className="settings-online-count" aria-hidden="true">
        {members.length > 99 ? '99+' : members.length}
      </span>
    </button>
  )
}
