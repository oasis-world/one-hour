// Slim world strip + collapsible feed (chronicle + leaderboard).
import { useState } from 'react'
import { useLang } from '../../lib/i18n'
import { tOpen } from './openWorldI18n'
import { phaseOf, eventText } from './mudLocale'
import { realmTitleOf } from './openWorldTypes'
import { useTranslatedTexts } from './useTranslated'
import type { OpenWorldSnapshot } from './openWorldTypes'

export function WorldSnapshot({ snap, onlineCount }: { snap: OpenWorldSnapshot; onlineCount: number }) {
  const lang = useLang()
  const [openFeed, setOpenFeed] = useState(false)
  const w = snap.world
  const progress = w.total_puzzles > 0 ? Math.round((w.solved_puzzles / w.total_puzzles) * 100) : 0
  const p = snap.myProfile
  const realm = p ? realmTitleOf(p.realm_level, lang) : ''
  const visibleLog = snap.log.slice(0, 5)
  const ev = snap.events[0] ? eventText(snap.events[0], lang) : null
  const tr = useTranslatedTexts(
    visibleLog.flatMap((l) => [
      { id: `${l.id}-a`, text: l.action, from: 'auto' },
      ...(l.result ? [{ id: `${l.id}-r`, text: l.result, from: 'auto' }] : []),
    ]),
    lang,
  )
  return (
    <section className="wmf-slim" aria-label={tOpen(lang, 'snapshotProgress')}>
      <div className="wmf-slim-line">
        <strong>{tOpen(lang, 'sealsBroken')} {w.solved_puzzles}/{w.total_puzzles}</strong>
        <span>{progress}% · {phaseOf(w.phase, lang)}</span>
        {p && <span>Lv{p.realm_level} {realm} · {p.xp} XP</span>}
      </div>
      <div className="wmf-progress"><i style={{ width: `${progress}%` }} /></div>
      <div className="wmf-slim-foot">
        <span className="wmf-slim-online"><span className="world-mud-online-dot" />{onlineCount} {tOpen(lang, 'onlineNow')}</span>
        <button className={`world-mud-footbtn ${openFeed ? 'is-on' : ''}`} onClick={() => setOpenFeed((v) => !v)}>{tOpen(lang, 'chronicle')} ({visibleLog.length})</button>
      </div>
      {openFeed && (
        <div className="wmf-feed">
          {ev && <div className="world-mud-event"><span>{snap.events[0]?.icon}</span><strong>{ev.title}</strong><span className="world-mud-event-desc">{ev.desc}</span></div>}
          {visibleLog.length === 0 && <div className="world-mud-online-pop-empty">{tOpen(lang, 'noLogYet')}</div>}
          {visibleLog.map((l) => <div key={l.id} className="wmf-logline"><b>{l.display_name}</b><span>{tr[`${l.id}-a`] ?? l.action}</span><span className="wmf-logres">{tr[`${l.id}-r`] ?? l.result}</span></div>)}
          {snap.leaderboard.length > 0 && (
            <div className="wmf-boardrow">{snap.leaderboard.slice(0, 3).map((pp, i) => <span key={pp.user_id} className="wmf-boarditem">#{i + 1} {pp.display_name} · Lv{pp.realm_level}</span>)}</div>
          )}
        </div>
      )}
    </section>
  )
}
