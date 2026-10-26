import { useLang, t } from '../lib/i18n'
import type { SyntheticEvent } from 'react'
import { STYLE_IDS, styleTitle } from '../lib/avatar'
import AvatarBadge from './AvatarBadge'
import { RefreshIcon } from './userIcons'

/**
 * Style catalog dropdown for the welcome/profile picker: every DiceBear
 * style with a live preview of the current seed. Tapping a row adopts
 * the style; the row's reroll button adopts it with a fresh seed —
 * randomness scoped to that one style.
 */
export default function StylePicker({
  seed,
  currentStyle,
  onPick,
}: {
  seed: string
  currentStyle: string
  onPick: (style: string, rerollSeed: boolean) => void
}) {
  const lang = useLang()
  const zh = lang === 'zh'
  const keepFocus = (e: SyntheticEvent) => e.preventDefault()

  return (
    <div className="style-picker" role="listbox" aria-label={t('选择风格', 'Choose a style')}>
      <div className="style-picker-list">
        {STYLE_IDS.map((id) => {
          const title = styleTitle(id)
          const rerollHint = zh ? `在 ${title} 风格里随机` : `Random in ${title}`
          return (
            <div
              key={id}
              className={`style-row${id === currentStyle ? ' is-current' : ''}`}
              role="option"
              aria-selected={id === currentStyle}
            >
              <button
                type="button"
                className="style-row-main"
                title={title}
                onMouseDown={keepFocus}
                onPointerDown={keepFocus}
                onClick={() => onPick(id, false)}
              >
                <AvatarBadge look={{ style: id, seed }} size={34} className="style-row-face" />
                <span className="style-row-name">{title}</span>
              </button>
              <button
                type="button"
                className="style-row-reroll"
                title={rerollHint}
                aria-label={rerollHint}
                onMouseDown={keepFocus}
                onPointerDown={keepFocus}
                onClick={() => onPick(id, true)}
              >
                <RefreshIcon size={12} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
