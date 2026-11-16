import { getSupabaseClient } from './supabaseClient'
import { isSupabaseConfigured } from './supabaseConfig'

export interface SlotJackpotRecipient {
  userId: string
  amount: number
}

export interface SlotJackpotState {
  pool: number
  version: number
  lastPayout: {
    payoutId: string
    total: number
    recipients: SlotJackpotRecipient[]
  } | null
}

export interface SlotPayoutResult {
  paid: boolean
  total?: number
  reason?: string
}

const EMPTY: SlotJackpotState = { pool: 0, version: 0, lastPayout: null }
const TABLE = 'slot_jackpots'

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function parseRow(row: Record<string, unknown> | null): SlotJackpotState {
  if (!row) return { ...EMPTY }
  const raw = row.last_payout as Record<string, unknown> | null
  const recipients = Array.isArray(raw?.recipients)
    ? (raw!.recipients as Array<Record<string, unknown>>).flatMap((item) => {
        const userId = item?.userId
        const amount = readNumber(item?.amount)
        return typeof userId === 'string' && amount > 0 ? [{ userId, amount: Math.floor(amount) }] : []
      })
    : []
  return {
    pool: Math.max(0, readNumber(row.pool)),
    version: readNumber(row.version),
    lastPayout: raw && typeof raw.payoutId === 'string'
      ? { payoutId: raw.payoutId, total: readNumber(raw.total), recipients }
      : null,
  }
}

/** Current pool for one card. Returns null when the backend is unavailable. */
export async function readSlotJackpot(instanceId: string): Promise<SlotJackpotState | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const client = await getSupabaseClient()
    const { data, error } = await client.from(TABLE).select('pool,version,last_payout').eq('instance_id', instanceId).maybeSingle()
    if (error) return null
    return parseRow(data as Record<string, unknown> | null)
  } catch {
    return null
  }
}

/** Live pool updates (contributions and payouts) for every viewer of the card. */
export function subscribeSlotJackpot(instanceId: string, onChange: (state: SlotJackpotState) => void): () => void {
  if (!isSupabaseConfigured()) return () => undefined
  let disposed = false
  let unsubscribe: (() => void) | undefined
  void (async () => {
    try {
      const client = await getSupabaseClient()
      if (disposed) return
      const channel = client.channel(`slot-jackpot:${instanceId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: TABLE, filter: `instance_id=eq.${instanceId}`,
        }, (payload) => {
          if (disposed) return
          if (payload.eventType === 'DELETE') onChange({ ...EMPTY })
          else onChange(parseRow(payload.new as Record<string, unknown>))
        })
        .subscribe()
      unsubscribe = () => { void client.removeChannel(channel) }
    } catch { /* Offline: the local pool simply stays as-is. */ }
  })()
  return () => {
    disposed = true
    unsubscribe?.()
  }
}

/** Add a slice of a big win. contributionId is unique per (card, spin). */
export async function contributeToSlotJackpot(instanceId: string, contributionId: string, amount: number): Promise<number | null> {
  if (!isSupabaseConfigured() || !Number.isFinite(amount) || amount <= 0) return null
  try {
    const client = await getSupabaseClient()
    const { data, error } = await client.rpc('slot_jackpot_contribute', {
      p_instance_id: instanceId,
      p_contribution_id: contributionId,
      p_amount: Math.floor(amount),
    })
    if (error || !Number.isFinite(data)) return null
    return Math.max(0, Math.floor(Number(data)))
  } catch {
    return null
  }
}

/** Pay the whole pool out to the board. payoutId is unique per pool version. */
export async function payoutSlotJackpot(
  instanceId: string,
  payoutId: string,
  recipients: SlotJackpotRecipient[],
): Promise<SlotPayoutResult | null> {
  if (!isSupabaseConfigured() || recipients.length === 0) return null
  try {
    const client = await getSupabaseClient()
    const { data, error } = await client.rpc('slot_jackpot_payout', {
      p_instance_id: instanceId,
      p_payout_id: payoutId,
      p_recipients: recipients.map((r) => ({ userId: r.userId, amount: Math.floor(r.amount) })),
    })
    if (error || !data || typeof data !== 'object') return null
    const result = data as Record<string, unknown>
    return { paid: result.paid === true, total: readNumber(result.total), reason: typeof result.reason === 'string' ? result.reason : undefined }
  } catch {
    return null
  }
}
