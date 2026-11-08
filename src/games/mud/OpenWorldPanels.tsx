// Puzzle answering + AI task generation + Guide Q&A panels (translated).
import { useState } from 'react'
import { useLang } from '../../lib/i18n'
import { useImeEnter } from '../../lib/ime'
import { tOpen } from './openWorldI18n'
import { submitPuzzleAnswer, appendLog, requestGenerateTask, requestGuide } from './openWorldStore'
import { puzzleTitle, puzzleRiddle, puzzleHint, langFamily } from './mudLocale'
import { useTranslatedTexts } from './useTranslated'
import type { OpenWorldSnapshot, PuzzleRow } from './openWorldTypes'
import { roomNameOf, districtNameOf } from '../../lib/worldI18n'

export function PuzzleRowItem({ puzzle, snap, userId, solved, onSolved }: {
  puzzle: PuzzleRow; snap: OpenWorldSnapshot; userId: string; solved: boolean; onSolved: (xp: number) => void
}) {
  const lang = useLang()
  const [answer, setAnswer] = useState('')
  const [msg, setMsg] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [busy, setBusy] = useState(false)
  const ime = useImeEnter()
  const baseTitle = puzzleTitle(puzzle, lang)
  const baseRiddle = puzzleRiddle(puzzle, lang)
  const baseHint = puzzleHint(puzzle, lang)
  const source = langFamily(lang) === 'zh' ? lang : 'en'
  const tr = useTranslatedTexts([
    { id: 't', text: baseTitle, from: source },
    { id: 'r', text: baseRiddle, from: source },
    ...(baseHint ? [{ id: 'h', text: baseHint, from: source }] : []),
  ], lang)
  const title = tr.t ?? baseTitle
  const riddle = tr.r ?? baseRiddle
  const hint = baseHint ? (tr.h ?? baseHint) : null
  async function submit() {
    if (!answer.trim() || busy) return
    setBusy(true)
    const res = await submitPuzzleAnswer(snap, userId, puzzle.id, answer, lang)
    if (res.ok) {
      setMsg(`${tOpen(lang, 'correct')} +${res.xpGain}`); onSolved(res.xpGain)
      await appendLog(userId, snap.myProfile?.display_name ?? '', puzzle.room_id, title, `+${res.xpGain} XP`, lang, 'puzzle')
    } else setMsg(tOpen(lang, 'wrong'))
    setBusy(false)
  }
  return (
    <div className={`wmf-puzzle ${solved ? 'is-solved' : ''}`}>
      <div className="wmf-puzzle-head"><strong>{title}</strong><span className="wmf-puzzle-meta">{roomNameOf(puzzle.room_id, lang)} · {tOpen(lang, 'reward')} +{puzzle.reward_xp} XP</span></div>
      <div className="wmf-puzzle-riddle">{riddle}</div>
      <div className="wmf-puzzle-actionsrow">
        {hint && <button className="world-mud-footbtn" onClick={() => setShowHint((v) => !v)}>{tOpen(lang, 'hint')}</button>}
        <span className="wmf-puzzle-solver">{puzzle.solver_count} {tOpen(lang, 'solved')}</span>
      </div>
      {showHint && hint && <div className="wmf-hint">{hint}</div>}
      <div className="world-mud-inputrow">
        <input className="world-mud-input" value={answer} disabled={solved || busy} placeholder={tOpen(lang, 'answerPlaceholder')} maxLength={80} {...ime.imeProps}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => { if (ime.imeConsumesEnter(e)) return; if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit() } }} />
        <button className="world-mud-send" aria-label={tOpen(lang, 'submit')} title={tOpen(lang, 'submit')} disabled={solved || busy || !answer.trim()} onClick={() => void submit()}>→</button>
      </div>
      {msg && <div className="wmf-msg">{msg}</div>}
    </div>
  )
}

export function TaskComposer({ snap, userId, roomId, onCreated }: {
  snap: OpenWorldSnapshot; userId: string; roomId: string; onCreated: () => void
}) {
  const lang = useLang()
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const ime = useImeEnter()
  async function generate() {
    if (!prompt.trim() || busy) return
    setBusy(true); setMsg('')
    const room = snap.rooms.find((r) => r.id === roomId)
    const res = await requestGenerateTask(prompt.trim(), roomId, room?.region_id ?? 'plaza', lang)
    if (res) {
      await appendLog(userId, snap.myProfile?.display_name ?? '', roomId, res.title, res.desc.slice(0, 60), lang, 'task')
      setMsg(`${res.title} — ${res.desc}`); setPrompt(''); onCreated()
    } else {
      const fallbackTitle = prompt.trim().slice(0, 24)
      await appendLog(userId, snap.myProfile?.display_name ?? '', roomId, fallbackTitle, '本地模式任务草稿', lang, 'task')
      setMsg(`${fallbackTitle} — ${tOpen(lang, 'offlineNote')}`); setPrompt(''); onCreated()
    }
    setBusy(false)
  }
  return (
    <div className="wmf-panel">
      <div className="wmf-panel-title">{tOpen(lang, 'genTaskTitle')}</div>
      <div className="world-mud-inputrow">
        <input className="world-mud-input" value={prompt} placeholder={tOpen(lang, 'genTaskPlaceholder')} maxLength={200} disabled={busy} {...ime.imeProps}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (ime.imeConsumesEnter(e)) return; if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void generate() } }} />
        <button className="world-mud-send" aria-label={tOpen(lang, 'generate')} title={tOpen(lang, 'generate')} disabled={busy || !prompt.trim()} onClick={() => void generate()}>{busy ? '…' : '→'}</button>
      </div>
      {msg && <div className="wmf-msg">{msg}</div>}
      <TaskList tasks={snap.tasks.slice(0, 3)} />
    </div>
  )
}

function TaskList({ tasks }: { tasks: OpenWorldSnapshot['tasks'] }) {
  const lang = useLang()
  const tr = useTranslatedTexts(
    tasks.flatMap((t) => [
      { id: `${t.id}-title`, text: t.ai_title, from: 'auto' },
      { id: `${t.id}-desc`, text: t.ai_desc, from: 'auto' },
    ]),
    lang,
  )
  if (tasks.length === 0) return null
  return (
    <div className="wmf-tasklist">
      {tasks.map((t) => (
        <div key={t.id} className="wmf-task"><b>{tr[`${t.id}-title`] ?? t.ai_title}</b><span>{districtNameOf(t.region_id, lang)} · {roomNameOf(t.room_id, lang)} · +{t.reward_xp} XP</span><div>{tr[`${t.id}-desc`] ?? t.ai_desc}</div></div>
      ))}
    </div>
  )
}

export function GuidePanel({ snap, userId }: { snap: OpenWorldSnapshot; userId: string }) {
  const lang = useLang()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState('')
  const ime = useImeEnter()
  async function ask() {
    if (!q.trim() || busy) return
    setBusy(true); setAnswer('')
    const a = await requestGuide(q.trim(), lang)
    setAnswer(a ?? `${tOpen(lang, 'offlineNote')} — ${snap.world.solved_puzzles}/${snap.world.total_puzzles}`)
    await appendLog(userId, snap.myProfile?.display_name ?? '', null as unknown as string, q.trim().slice(0, 40), 'guide', lang, 'help')
    setQ(''); setBusy(false)
  }
  return (
    <div className="wmf-panel">
      <div className="wmf-panel-title">{tOpen(lang, 'askTitle')}</div>
      <div className="world-mud-inputrow">
        <input className="world-mud-input" value={q} placeholder={tOpen(lang, 'askPlaceholder')} maxLength={200} disabled={busy} {...ime.imeProps}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (ime.imeConsumesEnter(e)) return; if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask() } }} />
        <button className="world-mud-send" aria-label={tOpen(lang, 'ask')} title={tOpen(lang, 'ask')} disabled={busy || !q.trim()} onClick={() => void ask()}>{busy ? '…' : '→'}</button>
      </div>
      {answer && <div className="wmf-msg">{answer}</div>}
      {snap.myHelp.length > 0 && snap.myHelp.slice(0, 2).map((h) => (
        <div key={h.id} className="wmf-qa"><b>{h.question}</b><span>{h.ai_answer}</span></div>
      ))}
    </div>
  )
}
