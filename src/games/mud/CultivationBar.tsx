// Cultivation (realm/XP) + equipment bars — 10-lang via openWorldI18n.
import { useLang } from '../../lib/i18n'
import { tOpen } from './openWorldI18n'
import { xpForLevel } from './openWorldTypes'
import type { PlayerProfileRow, ItemRow } from './openWorldTypes'

export function RealmProgress({ profile, lang: propLang }: { profile: PlayerProfileRow | null; lang?: string }) {
  const lang = useLang()
  void propLang
  if (!profile) return null
  const cur = xpForLevel(profile.realm_level)
  const next = xpForLevel(profile.realm_level + 1)
  const span = Math.max(1, next - cur)
  const pct = Math.min(100, Math.round(((profile.xp - cur) / span) * 100))
  return (
    <div className="wmf-realm">
      <span><b>{tOpen(lang, 'cultivation')}</b> · {tOpen(lang, 'realmLevel')} Lv{profile.realm_level} · {profile.realm_title}</span>
      <span className="wmf-xp">{tOpen(lang, 'xp')} {profile.xp} · 已破 {profile.total_solved}</span>
      <div className="wmf-progress"><i style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

export function EquipmentBar({ profile, items, lang: propLang }: { profile: PlayerProfileRow | null; items: ItemRow[]; lang?: string }) {
  const lang = useLang()
  void propLang
  if (!profile) return null
  const equipped = Object.entries(profile.equipped ?? {})
  const bag = items.slice(0, 4)
  return (
    <div className="wmf-equip">
      <div className="wmf-equip-title">{tOpen(lang, 'equipment')}</div>
      <div className="wmf-equip-row">
        {bag.map((it) => (
          <span key={it.id} className={`wmf-item rarity-${it.rarity}`} title={it.description ?? ''}>
            {it.icon} {lang.startsWith('zh') ? it.name : (it.name_en ?? it.name)}
          </span>
        ))}
        {equipped.length > 0 && <span className="wmf-equip-worn">⚔ {equipped.length}</span>}
      </div>
    </div>
  )
}
