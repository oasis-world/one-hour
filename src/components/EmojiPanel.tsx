import { useState, type SyntheticEvent } from 'react'
import { EMOJI_CATEGORIES } from '../lib/emoji'
import { t, useLang, type Lang } from '../lib/i18n'
import { loadRecent, recordEmojiUse } from '../lib/chatReactions'
import { ChevronDownIcon, ChevronRightIcon } from './icons'

const RECENT_LABEL: Record<Lang, string> = {
  zh: '最近',
  'zh-TW': '最近',
  en: 'Recent',
  ja: '最近',
  fr: 'Récents',
  es: 'Recientes',
  de: 'Zuletzt',
  ko: '최근',
  it: 'Recenti',
  ar: 'الأخيرة',
}

/**
 * The emoji popover above the composer. Mousedown/pointerdown on the grid
 * and its cells is prevented so tapping an emoji never steals the field's
 * focus — the keyboard stays up while the draft fills in, and no layout
 * shift eats the tap (same guard as the composer's own buttons).
 */
export default function EmojiPanel({ onInsert }: { onInsert: (emoji: string) => void }) {
  const lang = useLang()
  const [recent, setRecent] = useState<string[]>(() => loadRecent())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const keepFocus = (e: SyntheticEvent) => e.preventDefault()

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const insert = (emoji: string) => {
    recordEmojiUse(emoji)
    setRecent(loadRecent())
    onInsert(emoji)
  }

  return (
    <div className="popover emoji-panel" role="dialog" aria-label={t('表情选择', 'Emoji picker')}>
      <div className="emoji-grid" onMouseDown={(e) => e.preventDefault()}>
        {recent.length > 0 && (
          <section className="emoji-category" aria-label={RECENT_LABEL[lang]}>
            <button
              type="button"
              className="emoji-category-title emoji-category-toggle"
              onClick={() => toggle('recent')}
            >
              <span>{RECENT_LABEL[lang]}</span>
              <span className="emoji-category-chevron">
                {collapsed.has('recent') ? <ChevronRightIcon size={13} /> : <ChevronDownIcon size={13} />}
              </span>
            </button>
            {!collapsed.has('recent') && (
              <div className="emoji-category-grid">
                {recent.slice(0, 16).map((emoji, i) => (
                  <button
                    key={`recent-${emoji}-${i}`}
                    type="button"
                    className="emoji-cell"
                    aria-label={emoji}
                    title={emoji}
                    onMouseDown={(e) => e.preventDefault()}
                    onPointerDown={keepFocus}
                    onClick={() => insert(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
        {EMOJI_CATEGORIES.map((category) => (
          <section className="emoji-category" key={category.id} aria-label={t(category.title[0], category.title[1])}>
            <button
              type="button"
              className="emoji-category-title emoji-category-toggle"
              onClick={() => toggle(category.id)}
            >
              <span>{t(category.title[0], category.title[1])}</span>
              <span className="emoji-category-chevron">
                {collapsed.has(category.id) ? <ChevronRightIcon size={13} /> : <ChevronDownIcon size={13} />}
              </span>
            </button>
            {!collapsed.has(category.id) && (
              <div className="emoji-category-grid">
                {category.emojis.map((emoji, i) => (
                  <button
                    key={`${category.id}-${emoji}-${i}`}
                    type="button"
                    className="emoji-cell"
                    aria-label={emoji}
                    title={emoji}
                    onMouseDown={(e) => e.preventDefault()}
                    onPointerDown={keepFocus}
                    onClick={() => insert(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}