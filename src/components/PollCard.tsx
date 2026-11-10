import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PresenceMember } from '../lib/chatTypes'
import { t, useLang } from '../lib/i18n'
import { fetchPoll } from '../lib/pollRemote'
import {
  castPollVote,
  closePoll,
  fetchPollVotes,
  subscribeToPollVotes,
} from '../lib/pollVotes'
import {
  computePollTallies,
  formatPollRemaining,
  isPollOpen,
  pollRemainingMs,
  type PollData,
  type PollVoteRow,
} from '../lib/pollTypes'
import PollOption from './PollOption'
import { PollLoading, PollUnavailable } from './PollCardStates'
import { CountdownRingIcon } from './icons'
import './PollCard.css'

interface Props {
  pollId: string
  hostUserId: string
  selfId: string | null
  onlineMembers: PresenceMember[]
}
type LoadState = 'loading' | 'error' | 'ready'

export default function PollCard({ pollId, hostUserId, selfId, onlineMembers }: Props) {
  useLang()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [poll, setPoll] = useState<PollData | null>(null)
  const [votes, setVotes] = useState<PollVoteRow[]>([])
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const aliveRef = useRef(true)

  const load = useCallback(async () => {
    const [pollRes, voteRes] = await Promise.all([fetchPoll(pollId), fetchPollVotes(pollId)])
    if (!aliveRef.current) return
    if (!pollRes.ok || !voteRes.ok) {
      setLoadState('error')
      return
    }
    setPoll(pollRes.poll)
    setVotes(voteRes.votes)
    setLoadState('ready')
  }, [pollId])

  useEffect(() => {
    aliveRef.current = true
    // Initial ballot load; later updates arrive via the realtime callback below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    let unsubscribe: (() => void) | null = null
    void subscribeToPollVotes(pollId, () => void load()).then((off) => {
      if (!aliveRef.current) off()
      else unsubscribe = off
    })
    return () => {
      aliveRef.current = false
      unsubscribe?.()
    }
  }, [load, pollId])

  const open = poll ? isPollOpen(poll, now) : false
  useEffect(() => {
    if (!open) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [open])

  const tallies = useMemo(
    () => (poll ? computePollTallies(poll, votes) : null),
    [poll, votes],
  )
  const myVotes = useMemo(
    () => votes.filter((v) => v.userId === selfId).map((v) => v.optionIndex),
    [votes, selfId],
  )
  const selfName = useMemo(() => {
    if (!selfId) return t('我', 'You')
    const member = onlineMembers.find((m) => m.userId === selfId)
    return member?.displayName ?? t('我', 'You')
  }, [onlineMembers, selfId])
  const presenceById = useMemo(
    () => new Map(onlineMembers.map((m) => [m.userId, m])),
    [onlineMembers],
  )

  const pick = (index: number) => {
    if (!poll || !open || voting || !selfId) return
    const picked = myVotes.includes(index)
    const next = poll.multiple
      ? picked
        ? myVotes.filter((i) => i !== index)
        : [...myVotes, index]
      : picked
        ? []
        : [index]
    setError(null)
    setVoting(true)
    const previous = votes
    setVotes((prev) => [
      ...prev.filter((v) => v.userId !== selfId),
      ...next.map((optionIndex) => ({
        pollId,
        userId: selfId,
        optionIndex,
        displayName: selfName,
      })),
    ])
    void castPollVote({ pollId, userId: selfId, displayName: selfName, optionIndexes: next })
      .then((ok) => {
        if (!aliveRef.current) return
        if (!ok) {
          setVotes(previous)
          setError(t('投票发送失败，请重试', 'Could not send your vote — try again'))
        }
      })
      .finally(() => {
        if (aliveRef.current) setVoting(false)
      })
  }

  const onClosePoll = () => {
    if (!poll || !selfId || voting) return
    if (!window.confirm(t('关闭后大家就不能再投票了，确定吗？', 'Close voting for everyone?'))) return
    setVoting(true)
    void closePoll(pollId, selfId)
      .then((ok) => {
        if (!ok) setError(t('关闭失败，请重试', 'Could not close the poll — try again'))
        else void load()
      })
      .finally(() => {
        if (aliveRef.current) setVoting(false)
      })
  }

  if (loadState === 'loading') return <PollLoading />
  if (loadState === 'error' || !poll || !tallies) {
    return <PollUnavailable canRetry={loadState === 'error'} onRetry={() => void load()} />
  }

  const lead = Math.max(...tallies.counts, 0)
  const remaining = pollRemainingMs(poll, now)
  const createdMs = new Date(poll.createdAt).getTime()
  const expiresMs = new Date(poll.expiresAt).getTime()
  const totalMs = expiresMs - createdMs
  const remainingFraction = totalMs > 0 ? Math.min(1, Math.max(0, remaining / totalMs)) : 0
  const mine = selfId != null && hostUserId === selfId

  return (
    <section className={`poll-card${open ? '' : ' is-closed'}`} aria-label={poll.question}>
      <header className="poll-head">
        <span className="poll-badge">{t('投票', 'Poll')}</span>
        <span className="poll-mode">{poll.multiple ? t('多选', 'Multi') : t('单选', 'Single')}</span>
        {!open && <span className="poll-status">{t('已结束', 'Ended')}</span>}
        <h3 className="poll-question">{poll.question}</h3>
      </header>

      <div className="poll-options" role={poll.multiple ? 'group' : 'radiogroup'}>
        {poll.options.map((text, index) => {
          const count = tallies.counts[index] ?? 0
          return (
            <PollOption
              key={index}
              text={text}
              count={count}
              pct={tallies.totalVotes > 0 ? count / tallies.totalVotes : 0}
              selected={myVotes.includes(index)}
              isLead={lead > 0 && count === lead}
              disabled={!open || voting || !selfId}
              multiple={poll.multiple}
              voters={tallies.votersByOption.get(index) ?? []}
              presenceById={presenceById}
              onPick={() => pick(index)}
            />
          )
        })}
      </div>

      <footer className="poll-foot">
        <span>
          {tallies.voterCount > 0
            ? t(`${tallies.voterCount} 人参与 · ${tallies.totalVotes} 票`, `${tallies.voterCount} voters · ${tallies.totalVotes} votes`)
            : t('等待大家投票…', 'Waiting for votes…')}
        </span>
        <span className="poll-time">
          {open ? (
            <>
              <CountdownRingIcon size={13} progress={remainingFraction} />
              {formatPollRemaining(remaining)}
            </>
          ) : (
            '🏁'
          )}
        </span>
        {open && mine && (
          <button type="button" className="poll-close-btn" disabled={voting} onClick={onClosePoll}>
            {t('关闭投票', 'Close poll')}
          </button>
        )}
      </footer>
      {error && <p className="poll-error" role="alert">{error}</p>}
    </section>
  )
}
