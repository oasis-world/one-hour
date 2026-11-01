import { useRef, useState, type SyntheticEvent } from 'react'
import { EMOJI_CATEGORIES, EMOJI_SEARCH_TERMS } from '../lib/emoji'
import { useImeEnter } from '../lib/ime'
import { t } from '../lib/i18n'

/**
 * The emoji popover above the composer. Mousedown/pointerdown on the grid
 * and its cells is prevented so tapping an emoji never steals the field's
 * focus — the keyboard stays up while the draft fills in, and no layout
 * shift eats the tap (same guard as the composer's own buttons).
 */
export default function EmojiPanel({ onInsert }: { onInsert: (emoji: string) => void }) {
  const [query, setQuery] = useState('')
  const [filterQuery, setFilterQuery] = useState('')
  const composingRef = useRef(false)
  const ime = useImeEnter()
  const keepFocus = (e: SyntheticEvent) => e.preventDefault()
  const normalizedQuery = filterQuery.trim().toLocaleLowerCase()
  const categories = EMOJI_CATEGORIES.map((category) => {
    const titleMatches = [category.title[0], category.title[1], t(category.title[0], category.title[1])]
      .some((title) => title.toLocaleLowerCase().includes(normalizedQuery))
    return {
      ...category,
      visibleEmojis: !normalizedQuery || titleMatches
        ? category.emojis
        : category.emojis.filter((emoji) =>
            `${emoji} ${EMOJI_SEARCH_TERMS[emoji] ?? ''}`.toLocaleLowerCase().includes(normalizedQuery),
          ),
    }
  }).filter((category) => category.visibleEmojis.length > 0)

  return (
    <div className="popover emoji-panel" role="dialog" aria-label={t('表情选择', 'Emoji picker')}>
      <input
        className="emoji-search"
        type="search"
        {...ime.imeProps}
        value={query}
        onCompositionStart={() => {
          composingRef.current = true
          ime.imeProps.onCompositionStart()
        }}
        onCompositionEnd={(event) => {
          ime.imeProps.onCompositionEnd()
          const input = event.currentTarget
          window.setTimeout(() => {
            composingRef.current = false
            setQuery(input.value)
            setFilterQuery(input.value)
          }, 0)
        }}
        onChange={(event) => {
          const value = event.currentTarget.value
          setQuery(value)
          if (!composingRef.current && !(event.nativeEvent as InputEvent).isComposing) setFilterQuery(value)
        }}
        onKeyDown={(event) => {
          if (ime.imeConsumesEnter(event)) return
          if (event.key === 'Enter') event.preventDefault()
        }}
        placeholder={t('搜索表情', 'Search emoji')}
        aria-label={t('搜索表情', 'Search emoji')}
      />
      <div className="emoji-grid" onMouseDown={(e) => e.preventDefault()}>
        {categories.map((category) => (
          <section className="emoji-category" key={category.id} aria-label={t(category.title[0], category.title[1])}>
            <h3 className="emoji-category-title">{t(category.title[0], category.title[1])}</h3>
            <div className="emoji-category-grid">
              {category.visibleEmojis.map((emoji, i) => (
                <button
                  key={`${category.id}-${emoji}-${i}`}
                  type="button"
                  className="emoji-cell"
                  aria-label={emoji}
                  title={emoji}
                  onMouseDown={(e) => e.preventDefault()}
                  onPointerDown={keepFocus}
                  onClick={() => onInsert(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </section>
        ))}
        {categories.length === 0 && (
          <p className="emoji-no-results" role="status">{t('没有找到表情', 'No emoji found')}</p>
        )}
      </div>
    </div>
  )
}
