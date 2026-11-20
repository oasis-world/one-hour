import { useCallback, useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured } from '../../lib/supabaseConfig'
import { useAccount } from '../../lib/useAccount'
import { resolveChatIdentity } from '../../lib/identity'
import { loadUserProfile } from '../../lib/userProfile'
import { adjustStarPoints } from '../../lib/starPoints'
import { useLang } from '../../lib/i18n'
import { MESSAGE_TTL_MS } from '../../lib/expiry'
import {
  castResonanceVote, clearResonanceVote, createResonance, loadResonance, loadVotes,
  subscribeResonanceVotes,
} from '../../lib/resonanceRemote'
import { currentPhase, questionFor, resonantWith, tallyVotes } from './logic'
import { requestQuestions } from './questions'
import { maybePostRevealNotice } from './notice'
import type { ResonanceData } from '../../lib/resonanceRemote'
import type { ResonancePhase, ResonanceVote } from './types'
import ResonanceBoard from './ResonanceBoard'
import ResonanceLoading from './ResonanceLoading'

interface Props {
  instanceId: string
  hostUserId: string
  onlineMembers?: import('../../lib/chatTypes').PresenceMember[]
}

const REWARD_KEY = (id: string, round: number, uid: string) => `resonance-rewarded:${id}:${round}:${uid}`

export default function ResonanceGame({ instanceId, hostUserId, onlineMembers = [] }: Props) {
  const lang = useLang()
  const account = useAccount()
  const identity = resolveChatIdentity(account)
  const profile = loadUserProfile()
  const selfId = identity?.userId ?? null
  const [data, setData] = useState<ResonanceData | null>(null)
  const [votes, setVotes] = useState<ResonanceVote[]>([])
  const [phase, setPhase] = useState<ResonancePhase>(() => currentPhase(Date.now()))
  const [now, setNow] = useState(() => Date.now())
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [myOption, setMyOption] = useState<Record<number, string>>({})
  const noticedRef = useRef<Set<number>>(new Set())
  const dataRef = useRef<ResonanceData | null>(null)
  // One AI call per card, even across StrictMode double-run.
  const generatingRef = useRef<Promise<void> | null>(null)
  const votesRef = useRef<ResonanceVote[]>([])
  const selfRef = useRef(selfId)
  useEffect(() => { selfRef.current = selfId }, [selfId])
  const refreshVotes = useCallback(() => {
    void loadVotes(instanceId).then((rows) => {
      votesRef.current = rows
      setVotes(rows)
      const me = selfRef.current
      if (me) {
        const latest: Record<number, string> = {}
        for (const v of rows) if (v.userId === me) latest[v.round] = v.optionId
        setMyOption(latest)
      }
    })
  }, [instanceId])

  const applyData = useCallback((row: ResonanceData) => {
    dataRef.current = row
    setData(row)
    setLoading(false)
    setOffline(false) // card is live for everyone
  }, [])

  // 1) Load or create the row. Only the host generates questions.
  useEffect(() => {
    let alive = true
    void (async () => {
      if (!isSupabaseConfigured()) {
        if (alive) setOffline(true)
        return
      }
      const existing = await loadResonance(instanceId)
      if (existing) {
        if (alive) applyData(existing)
        return
      }
      // Non-hosts wait for the host's row (poll below); not offline.
      if (!selfId || selfId !== hostUserId) return
      // One generation per card. The ref survives StrictMode remount, so both
      // effect runs await the SAME single AI call.
      if (!generatingRef.current) {
        generatingRef.current = (async () => {
          const generated = await requestQuestions(lang)
          const expiresAt = Date.now() + MESSAGE_TTL_MS
          const ok = await createResonance({ instanceId, questions: generated.questions, expiresAt })
          if (ok) {
            const fresh = await loadResonance(instanceId)
            if (fresh) applyData(fresh)
          }
        })()
      }
      await generatingRef.current
      if (!alive) return
      if (!dataRef.current) setOffline(true)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [instanceId, hostUserId, selfId, lang, applyData])

  // 2) Poll for the row until it shows up (non-hosts / slow AI).
  useEffect(() => {
    if (data || !isSupabaseConfigured()) return
    const id = window.setInterval(() => {
      void loadResonance(instanceId).then((row) => { if (row) applyData(row) })
    }, 2000)
    return () => window.clearInterval(id)
  }, [instanceId, data, applyData])

  useEffect(() => {
    refreshVotes()
    if (!isSupabaseConfigured()) return
    const stop = subscribeResonanceVotes(instanceId, refreshVotes)
    const poll = window.setInterval(refreshVotes, 10_000)
    return () => { stop(); window.clearInterval(poll) }
  }, [instanceId, refreshVotes])

  useEffect(() => {
    const d = dataRef.current
    if (!d) return
    setPhase(currentPhase(d.createdAt))
    const id = window.setInterval(() => {
      const t = Date.now()
      setNow(t); setPhase(currentPhase(d.createdAt, t))
    }, 1000)
    return () => window.clearInterval(id)
  }, [data])

  const onVote = useCallback((optionId: string) => {
    const d = dataRef.current
    if (!d || !selfId || phase.kind !== 'voting') return
    setOffline(false)
    const optionIndex = d.questions.length ? (questionFor(d.questions, phase.round)?.options.findIndex((o) => o.id === optionId) ?? -1) : -1
    if (optionIndex < 0) return
    const name = profile?.nickname ?? identity?.displayName ?? '旅人'
    void castResonanceVote({
      instanceId, round: phase.round, userId: selfId, optionIndex,
      displayName: name, avatarStyle: profile?.style ?? identity?.avatar?.style ?? '',
      avatarSeed: profile?.seed ?? identity?.avatar?.seed ?? selfId,
      avatarUrl: profile?.avatarUrl ?? identity?.avatarUrl ?? null,
    }).then((ok) => {
      if (!ok) return
      refreshVotes()
      const key = REWARD_KEY(instanceId, phase.round, selfId)
      try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1') } catch { /* ignore */ }
      adjustStarPoints(2, true)
    })
  }, [instanceId, selfId, phase, profile, identity, refreshVotes])

  // Change vote: clear my ballot; points stay (reward key remains).
  const onClearVote = useCallback(() => {
    if (!selfId || phase.kind !== 'voting') return
    setOffline(false)
    void clearResonanceVote(instanceId, phase.round, selfId).then((ok) => {
      if (ok) {
        setMyOption((prev) => {
          const next = { ...prev }
          delete next[phase.round]
          return next
        })
        refreshVotes()
      }
    })
  }, [instanceId, selfId, phase, refreshVotes])
  useEffect(() => {
    if (phase.kind !== 'reveal' || !data || !selfId) return
    if (noticedRef.current.has(phase.round)) return
    const q = questionFor(data.questions, phase.round)
    if (!q) return
    const posted = maybePostRevealNotice({
      instanceId, round: phase.round, question: q, tally: tallyVotes(votes, phase.round),
      selfId, onlineMembers, expiresAt: Date.now() + MESSAGE_TTL_MS, lang,
    })
    if (posted) noticedRef.current.add(phase.round)
  }, [phase, data, votes, selfId, lang, instanceId, onlineMembers])

  if (loading || !data) {
    return <ResonanceLoading offline={offline} />
  }
  const question = questionFor(data.questions, phase.round)
  if (!question) return <ResonanceLoading />

  const tally = tallyVotes(votes, phase.round)
  const myId = myOption[phase.round] ?? null
  const matches = resonantWith(votes, phase.round, selfId ?? '', myId)
  const canVote = phase.kind === 'voting' && isSupabaseConfigured() && Boolean(selfId)

  return (
    <ResonanceBoard
      question={question} phase={phase} tally={tally}
      myOptionId={myId} matches={matches}
      onVote={onVote} onClearVote={onClearVote}
      canVote={canVote} offline={offline} now={now}
    />
  )
}
