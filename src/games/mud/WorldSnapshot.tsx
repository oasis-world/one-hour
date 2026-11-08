// World snapshot + chronicle + leaderboard for the open MUD card.
import { useLang } from '../../lib/i18n'
import { tOpen } from './openWorldI18n'
import type { OpenWorldSnapshot } from './openWorldTypes'
import { DistrictIcon, WorldHourglassIcon } from './MudIcons'

export function WorldSnapshot({ snap, onlineCount }: { snap: OpenWorldSnapshot; onlineCount: number }) {
  const lang = useLang()
  const w = snap.world
  const progress = w.total_puzzles > 0 ? Math.round((w.solved_puzzles / w.total_puzzles) * 100) : 0
  return (
    <section className="wmf-snap" aria-label={tOpen(lang, 'snapshotProgress')}>
      <div className="wmf-snap-head">
        <span className="wmf-snap-icon"><WorldHourglassIcon size={16} /></span>
        <strong>{tOpen(lang, 'snapshotProgress')}</strong>
        <span className="wmf-snap-phase">{tOpen(lang, 'phase')}: {w.phase}</span>
        <span className="wmf-snap-online"><span className="world-mud-online-dot" />{onlineCount} {tOpen(lang, 'onlineNow')}</span>
      </div>
      <div className="wmf-progress"><i style={{ width: `${progress}%` }} /></div>
      <div className="wmf-snap-line">
        {tOpen(lang, 'sealsBroken')}: <b>{w.solved_puzzles}{tOpen(lang, 'of')}{w.total_puzzles}</b> · {progress}% · Epoch {w.epoch}
      </div>
      {snap.events[0] && (
        <div className="world-mud-event"><span>{snap.events[0].icon}</span><strong>{snap.events[0].title}</strong><span className="world-mud-event-desc">{snap.events[0].description}</span></div>
      )}
      <div className="wmf-chronicle">
        <div className="wmf-chronicle-head">{tOpen(lang, 'chronicle')}</div>
        {snap.log.length === 0 && <div className="world-mud-online-pop-empty">{tOpen(lang, 'noLogYet')}</div>}
        {snap.log.slice(0, 6).map((l) => (
          <div key={l.id} className="wmf-logline"><b>{l.display_name}</b><span>{l.action}</span><span className="wmf-logres">{l.result}</span></div>
        ))}
      </div>
      {snap.leaderboard.length > 0 && (
        <div className="wmf-board">
          <div className="wmf-chronicle-head">{tOpen(lang, 'leaderboard')}</div>
          <div className="wmf-boardrow">{snap.leaderboard.slice(0, 3).map((p, i) => (
            <span key={p.user_id} className="wmf-boarditem">#{i + 1} {p.display_name} · Lv{p.realm_level}</span>
          ))}</div>
        </div>
      )}
    </section>
  )
}

export function RegionChip({ regionId, active }: { regionId: string; active: boolean }) {
  return (
    <span className={`wmf-regionchip ${active ? 'is-active' : ''}`}>
      <DistrictIcon id={regionId as never} size={14} />
    </span>
  )
}
