import { t } from '../lib/i18n'
import { getQuickEmojis } from '../lib/chatReactions'
import { CopyIcon, MoreIcon, TrashIcon } from './icons'

interface Props {
  mine: boolean
  onReact: (emoji: string) => void
  onCopy: () => void
  /** Opens the shared confirm dialog anchored at the delete button. */
  onDelete: (anchor: { x: number; y: number }) => void
  onMore: (anchor: { x: number; y: number }) => void
}

/**
 * Discord-style hover toolbar (oasis room pattern): floats at the row's
 * top-right, quick emojis react in one tap, More opens the full context
 * menu. Appears on row hover / focus-within (pure CSS), never on touch —
 * phones get the long-press bottom sheet instead. Delete shows only on
 * the player's own messages. Every action blurs its button first: without
 * it the row keeps matching :focus-within after the tap and the bar would
 * stick around after the mouse leaves.
 */
export default function MsgHoverBar({ mine, onReact, onCopy, onDelete, onMore }: Props) {
  return (
    <div className="msg-hoverbar" role="toolbar" aria-label={t('消息操作', 'Message actions')}>
      {getQuickEmojis(4).map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="msg-hoverbar-btn is-emoji"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            e.currentTarget.blur()
            onReact(emoji)
          }}
          aria-label={`React ${emoji}`}
        >
          {emoji}
        </button>
      ))}
      <span className="msg-hoverbar-sep" aria-hidden="true" />
      <button
        type="button"
        className="msg-hoverbar-btn"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          e.currentTarget.blur()
          onCopy()
        }}
        aria-label={t('复制', 'Copy')}
        title={t('复制', 'Copy')}
      >
        <CopyIcon size={18} />
      </button>
      {mine && (
        <button
          type="button"
          className="msg-hoverbar-btn is-danger"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            const rect = e.currentTarget.getBoundingClientRect()
            e.currentTarget.blur()
            onDelete({ x: rect.left, y: rect.bottom + 4 })
          }}
          aria-label={t('删除', 'Delete')}
          title={t('删除', 'Delete')}
        >
          <TrashIcon size={18} />
        </button>
      )}
      <button
        type="button"
        className="msg-hoverbar-btn"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          const rect = e.currentTarget.getBoundingClientRect()
          e.currentTarget.blur()
          onMore({ x: rect.left, y: rect.bottom + 4 })
        }}
        aria-haspopup="menu"
        aria-label={t('更多操作', 'More actions')}
        title={t('更多', 'More')}
      >
        <MoreIcon size={18} />
      </button>
    </div>
  )
}
