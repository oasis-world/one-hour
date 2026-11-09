import { getSupabaseClient } from './supabaseClient'
import { isSupabaseConfigured } from './supabaseConfig'
import { withTimeout } from './withTimeout'
import type { PollData } from './pollTypes'

/**
 * Supabase remote layer for polls: the `polls` row carries the
 * question/options (same one-hour lifecycle as the card message).
 * Ballot writes live in pollVotes.ts; tallies are always recomputed
 * client-side from the live `poll_votes` rows.
 */

const POLLS_TABLE = 'polls'
const POLL_TIMEOUT_MS = 15_000

interface PollRow {
  poll_id: string
  user_id: string
  question: string
  options: unknown
  multiple: boolean
  closed_at: string | null
  created_at: string
  expires_at: string
}

function rowToPoll(row: PollRow): PollData {
  return {
    pollId: row.poll_id,
    userId: row.user_id,
    question: row.question,
    options: Array.isArray(row.options) ? (row.options as unknown[]).map((o) => String(o)) : [],
    multiple: Boolean(row.multiple),
    closedAt: row.closed_at ?? null,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }
}

export async function pollClient() {
  if (!isSupabaseConfigured()) return null
  try {
    const client = await getSupabaseClient()
    const { data } = await client.auth.getSession()
    if (!data.session?.user?.id) return null
    return client
  } catch {
    return null
  }
}

export async function createPoll(input: {
  pollId: string
  userId: string
  question: string
  options: string[]
  multiple: boolean
  expiresAt: number
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await pollClient()
  if (!client) return { ok: false, error: 'offline' }
  try {
    const { error } = await withTimeout(
      client.from(POLLS_TABLE).insert({
        poll_id: input.pollId,
        user_id: input.userId,
        question: input.question,
        options: input.options,
        multiple: input.multiple,
        expires_at: new Date(input.expiresAt).toISOString(),
      }),
      POLL_TIMEOUT_MS,
    )
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function fetchPoll(
  pollId: string,
): Promise<{ poll: PollData | null; ok: boolean }> {
  const client = await pollClient()
  if (!client) return { poll: null, ok: false }
  try {
    const { data, error } = await withTimeout(
      client
        .from(POLLS_TABLE)
        .select('poll_id,user_id,question,options,multiple,closed_at,created_at,expires_at')
        .eq('poll_id', pollId)
        .maybeSingle(),
      POLL_TIMEOUT_MS,
    )
    if (error) return { poll: null, ok: false }
    return { poll: data ? rowToPoll(data as PollRow) : null, ok: true }
  } catch {
    return { poll: null, ok: false }
  }
}

export async function deletePoll(pollId: string): Promise<void> {
  const client = await pollClient()
  if (!client) return
  try {
    // Votes cascade from the polls row.
    await client.from(POLLS_TABLE).delete().eq('poll_id', pollId)
  } catch {
    // Orphan rows are swept by the hourly purge.
  }
}
