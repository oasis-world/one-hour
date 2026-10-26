import { EMOJI_LIST } from '../lib/emoji'

/**
 * The emoji popover above the composer. Mousedown is prevented on the
 * grid and its cells so tapping an emoji never steals the field's focus —
 * the keyboard stays up while the draft fills in.
 */
export default function EmojiPanel({ onInsert }: { onInsert: (emoji: string) => void }) {
  return (
    <div className="popover emoji-panel" role="dialog" aria-label="表情选择">
      <div className="emoji-grid" onMouseDown={(e) => e.preventDefault()}>
        {EMOJI_LIST.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="emoji-cell"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onInsert(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
