import AvatarBadge from '../../components/AvatarBadge'
import { rt, questionText, optionText } from './resonanceText'
import { formatRemaining, type Tally } from './logic'
import type { ResonancePhase, ResonanceQuestion } from './types'
import { useLang } from '../../lib/i18n'
import './ResonanceGame.css'

interface Props {
  question: ResonanceQuestion
  phase: ResonancePhase
  tally: Tally
  myOptionId: string | null
  matches: ReturnType<typeof import('./logic').resonantWith>
  onVote: (optionId: string) => void
  onClearVote: () => void
  canVote: boolean
  offline: boolean
  now: number
}

function Avatars({ voters }: { voters: Array<{ userId: string; displayName: string; avatarStyle: string; avatarSeed: string; avatarUrl: string | null }> }) {
  const shown = voters.slice(0, 5)
  return (
    <span className="res-avatars">
      {shown.map((v) => (
        <AvatarBadge
          key={v.userId}
          look={{ style: v.avatarStyle, seed: v.avatarSeed, avatarUrl: v.avatarUrl }}
          size={20}
          className="res-avatar"
        />
      ))}
      {voters.length > shown.length && <span className="res-avatar-more">+{voters.length - shown.length}</span>}
    </span>
  )
}

export default function ResonanceBoard({ question, phase, tally, myOptionId, matches, onVote, onClearVote, canVote, offline, now }: Props) {
  const lang = useLang()
  const voting = phase.kind === 'voting'
  const reveal = !voting
  const total = Math.max(1, tally.total)
  const headerLabel = voting ? 'VOTING' : 'REVEALING'
  // Once voted, lock every option until the user taps "改票" (which clears the
  // ballot and re-enables voting). Reveal phase is always read-only.
  const locked = voting && Boolean(myOptionId) && canVote

  return (
    <div className={`res-board${reveal ? ' is-reveal' : ''}`}>
      <span className="res-corner-timer" title={rt('Next round in')}>
        {formatRemaining(Math.max(0, phase.endsAt - now))}
      </span>
      <div className="res-head">
        <div className="res-title">
          <span className="res-pulse" aria-hidden="true" />
          {rt('FIND YOUR FREQUENCY')}
        </div>
        <div className="res-sub">{rt('One card · live all hour')}</div>
      </div>

      <div className="res-meta">
        <span className={`res-phase ${voting ? 'is-voting' : 'is-reveal'}`}>{rt(headerLabel)}</span>
        <span className="res-round">{rt('ROUND')} {phase.round + 1}</span>
      </div>

      <div className="res-question">{questionText(lang, question.prompt)}</div>
      <div className="res-hint">
        {voting ? rt('Pick what feels like you — no right answer.') : (matches.length > 0
          ? `${rt('IN SYNC')} · ${matches.length} ${rt('people picked the same as you')}`
          : rt('No one matched this round — next one!'))}
      </div>

      <div className="res-options">
        {question.options.map((o) => {
          const count = tally.counts[o.id] ?? 0
          const pct = reveal ? Math.round((count / total) * 100) : 0
          const mine = myOptionId === o.id
          const voters = tally.votersByOption[o.id] ?? []
          return (
            <button
              key={o.id}
              type="button"
              className={`res-option${mine ? ' is-mine' : ''}${reveal && count > 0 ? ' is-top' : ''}`}
              disabled={!canVote || locked}
              onClick={() => onVote(o.id)}
              aria-label={optionText(lang, o.label)}
            >
              {reveal && <span className="res-bar" style={{ width: `${pct}%` }} aria-hidden="true" />}
              <span className="res-option-emoji" aria-hidden="true">{o.emoji}</span>
              <span className="res-option-label">{optionText(lang, o.label)}</span>
              <span className="res-option-right">
                {voting ? (mine ? <span className="res-check">✓</span> : null) : (
                  <span className="res-count">{count} {rt('votes')}</span>
                )}
              </span>
              {reveal && voters.length > 0 && <span className="res-voters"><Avatars voters={voters} /></span>}
            </button>
          )
        })}
      </div>

      <div className="res-footer">
        {offline ? <span className="res-offline">{rt('Offline · voting is unavailable')}</span>
          : myOptionId ? (
            <span className="res-you">
              <b>{rt('VOTED_N_POINTS')}</b>
              {voting && canVote && (
                <button type="button" className="res-change" onClick={onClearVote}>
                  {rt('Change your vote')}
                </button>
              )}
            </span>
          ) : (
            <span className="res-invite">{tally.total === 0 ? rt('waiting for the first vote…') : `${tally.total} ${rt('votes')} · ${rt('Join the fun by voting')}`}</span>
          )}
      </div>
    </div>
  )
}
