import type { SyntheticEvent } from 'react'
import { EMOJI_LIST } from '../lib/emoji'

/**
 * The emoji popover above the composer. Mousedown/pointerdown on the grid
 * and its cells is prevented so tapping an emoji never steals the field's
 * focus — the keyboard stays up while the draft fills in, and no layout
 * shift eats the tap (same guard as the composer's own buttons).
 */
export default function EmojiPanel({ onInsert }: { onInsert: (emoji: string) => void }) {
  const keepFocus = (e: SyntheticEvent) => e.preventDefault()
  return (
    <div className="popover emoji-panel" role="dialog" aria-label="表情选择">
      <div className="emoji-grid" onMouseDown={(e) => e.preventDefault()}>
        {EMOJI_LIST.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            type="button"
            className="emoji-cell"
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={keepFocus}
            onClick={() => onInsert(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
