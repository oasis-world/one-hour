import type { PresenceMember } from '../lib/chatTypes'
import { t } from '../lib/i18n'
import { userAvatarTint } from '../lib/identity'
import type { PollVoteRow } from '../lib/pollTypes'
import AvatarBadge from './AvatarBadge'

interface Props {
  text: string
  count: number
  pct: number
  selected: boolean
  isLead: boolean
  /** Null for non-interactive rendering (closed / no self). */
  disabled: boolean
  multiple: boolean
  voters: PollVoteRow[]
  presenceById: Map<string, PresenceMember>
  onPick: () => void
}

/** One clickable option: behind-the-bar percentage, tick, voter stack. */
export default function PollOption({
  text, count, pct, selected, isLead, disabled, multiple, voters, presenceById, onPick,
}: Props) {
  return (
    <button
      type="button"
      className={`poll-option${selected ? ' is-mine' : ''}${isLead ? ' is-lead' : ''}`}
      disabled={disabled}
      aria-pressed={multiple ? selected : undefined}
      aria-checked={!multiple ? selected : undefined}
      role={!multiple ? 'radio' : undefined}
      aria-label={`${text} — ${count}${count > 0 ? `, ${Math.round(pct * 100)}%` : ''}`}
      onClick={onPick}
    >
      <span className="poll-bar" style={{ width: `${Math.round(pct * 100)}%` }} aria-hidden="true" />
      <span className="poll-option-text">{text}</span>
      {selected && <span className="poll-check" aria-hidden="true">✓</span>}
      <span className="poll-count">{count > 0 ? `${Math.round(pct * 100)}% · ${count}` : ''}</span>
      {voters.length > 0 && (
        <span className="poll-avatars" aria-hidden="true">
          {voters.slice(0, 3).map((v) => {
            const member = presenceById.get(v.userId)
            const name = member?.displayName ?? v.displayName ?? t('我', 'You')
            return member?.avatarStyle && member?.avatarSeed ? (
              <AvatarBadge key={v.userId} look={{ style: member.avatarStyle, seed: member.avatarSeed, avatarUrl: member.avatarUrl }} size={18} />
            ) : (
              <span key={v.userId} className="poll-avatar" style={{ background: userAvatarTint(v.userId) }} title={name}>
                {name.slice(0, 1).toUpperCase()}
              </span>
            )
          })}
          {voters.length > 3 && <span className="poll-avatar poll-more">+{voters.length - 3}</span>}
        </span>
      )}
    </button>
  )
}
