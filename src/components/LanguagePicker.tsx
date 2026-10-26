import { LANGS, LANG_LABELS, setLang, type Lang, t } from '../lib/i18n'
import LangFlag from './LangFlag'

export default function LanguagePicker({
  selected,
  onSelect,
  onBack,
}: {
  selected: Lang
  onSelect: () => void
  onBack: () => void
}) {
  return (
    <div className="settings-pop language-picker-pop">
      <button type="button" className="settings-subview-back" onClick={onBack}>
        <span aria-hidden="true">‹</span>
        {t('设置', 'Settings')}
      </button>
      <div role="menu" aria-label={t('语言', 'Language')}>
        {LANGS.map((code) => (
          <button
            key={code}
            type="button"
            className={`settings-row${code === selected ? ' is-current' : ''}`}
            role="menuitem"
            onClick={() => {
              setLang(code)
              onSelect()
            }}
          >
            <LangFlag code={code} />
            <span className="settings-row-label">{LANG_LABELS[code]}</span>
            {code === selected && <span className="settings-row-value">✓</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
