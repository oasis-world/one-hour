import { withTimeout } from './withTimeout'
import { pollClient } from './pollRemote'
import type { PollVoteRow } from './pollTypes'

/**
 * Ballot box for polls: fetch / rewrite one voter's picks and subscribe
 * to live changes (Realtime distributes every cast, change and close).
 */

const VOTES_TABLE = 'poll_votes'
const POLLS_TABLE = 'polls'
const POLL_TIMEOUT_MS = 15_000

interface VoteRow {
  poll_id: string
  user_id: string
  option_index: number
  display_name: string | null
}

export async function fetchPollVotes(
  pollId: string,
): Promise<{ votes: PollVoteRow[]; ok: boolean }> {
  const client = await pollClient()
  if (!client) return { votes: [], ok: false }
  try {
    const { data, error } = await withTimeout(
      client
        .from(VOTES_TABLE)
        .select('poll_id,user_id,option_index,display_name')
        .eq('poll_id', pollId),
      POLL_TIMEOUT_MS,
    )
    if (error) return { votes: [], ok: false }
    const votes = ((data ?? []) as VoteRow[]).map((row) => ({
      pollId: row.poll_id,
      userId: row.user_id,
      optionIndex: row.option_index,
      displayName: row.display_name ?? null,
    }))
    return { votes, ok: true }
  } catch {
    return { votes: [], ok: false }
  }
}

/**
 * Totally rewrites the caller's ballot: delete their rows, then insert
 * the fresh set. Works for both single-pick (one index) and multi-pick.
 */
export async function castPollVote(input: {
  pollId: string
  userId: string
  displayName: string
  optionIndexes: number[]
}): Promise<boolean> {
  const client = await pollClient()
  if (!client) return false
  try {
    const { error: delError } = await withTimeout(
      client
        .from(VOTES_TABLE)
        .delete()
        .eq('poll_id', input.pollId)
        .eq('user_id', input.userId),
      POLL_TIMEOUT_MS,
    )
    if (delError) return false
    if (input.optionIndexes.length === 0) return true
    const rows = input.optionIndexes.map((optionIndex) => ({
      poll_id: input.pollId,
      user_id: input.userId,
      option_index: optionIndex,
      display_name: input.displayName,
    }))
    const { error: insError } = await withTimeout(
      client.from(VOTES_TABLE).insert(rows),
      POLL_TIMEOUT_MS,
    )
    return !insError
  } catch {
    return false
  }
}

/** Creator-only close: freezes the ballot but keeps results visible. */
export async function closePoll(pollId: string, userId: string): Promise<boolean> {
  const client = await pollClient()
  if (!client) return false
  try {
    const { error } = await withTimeout(
      client
        .from(POLLS_TABLE)
        .update({ closed_at: new Date().toISOString() })
        .eq('poll_id', pollId)
        .eq('user_id', userId),
      POLL_TIMEOUT_MS,
    )
    return !error
  } catch {
    return false
  }
}

/** Subscribe to live ballot changes for one poll (votes + close). */
export async function subscribeToPollVotes(
  pollId: string,
  onChange: () => void,
): Promise<() => void> {
  const client = await pollClient()
  if (!client) return () => {}
  const channel = client.channel(`poll:${pollId}`)
  channel
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: VOTES_TABLE, filter: `poll_id=eq.${pollId}` },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: POLLS_TABLE, filter: `poll_id=eq.${pollId}` },
      () => onChange(),
    )
    .subscribe()
  return () => {
    void (async () => {
      try {
        await client.removeChannel(channel)
      } catch {
        // Already gone (StrictMode remount race).
      }
    })()
  }
}
