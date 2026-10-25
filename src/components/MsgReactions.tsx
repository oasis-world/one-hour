import type { RoomReactionMap } from '../lib/chatReactions'

interface Props {
  reactions: RoomReactionMap
  onToggle: (emoji: string) => void
}

/**
 * Reaction pills under a message (oasis room pattern): emoji + count in a
 * rounded chip; the ones I added glow in the accent color. Tapping an
 * existing pill toggles my own reaction on/off.
 */
export default function MsgReactions({ reactions, onToggle }: Props) {
  const list = Object.entries(reactions)
  if (list.length === 0) return null
  return (
    <div className="msg-reactions">
      {list.map(([emoji, info]) => (
        <button
          key={emoji}
          type="button"
          className={`msg-reaction${info.own ? ' is-own' : ''}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onToggle(emoji)
          }}
          aria-label={`${emoji} ${info.count}`}
          title={`${emoji} × ${info.count}`}
        >
          <span aria-hidden="true">{emoji}</span>
          <span className="msg-reaction-count">{info.count}</span>
        </button>
      ))}
    </div>
  )
}
