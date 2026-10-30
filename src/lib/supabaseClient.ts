import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabaseConfig'

let client: Promise<SupabaseClient> | null = null

/**
 * Lazily imported SDK + singleton. The dynamic import keeps the SDK chunk
 * out of the first paint; with auth unconfigured the chunk never loads.
 * Sessions persist in localStorage so a refresh keeps the identity.
 */
export function getSupabaseClient(): Promise<SupabaseClient> {
  if (!client) {
    const pending = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
      }),
    )
    client = pending.catch((error: unknown) => {
      client = null
      throw error
    })
  }
  return client
}
