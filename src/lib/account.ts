import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured } from './supabaseConfig'
import { getSupabaseClient } from './supabaseClient'
import { VAULT_KEYS, vaultGet, vaultRemove, vaultSet } from './vault'

export { isSupabaseConfigured }

/**
 * Account identity service, ported from the oasis-game pattern: every
 * failure path degrades to 'guest' and nothing here ever blocks the UI.
 * Anonymous sign-in gives every visitor a stable user id automatically;
 * binding an email upgrades the same id (messages are never orphaned).
 */

export type AccountStatus = 'guest' | 'anonymous' | 'signedIn'

export interface AccountState {
  status: AccountStatus
  userId: string | null
  email: string | null
}

export type AuthErrorKind =
  | 'invalid-input'
  | 'network'
  | 'invalid-credentials'
  | 'email-unconfirmed'
  | 'email-taken'
  | 'weak-password'
  | 'rate-limited'
  | 'unknown'

export interface AuthActionResult {
  ok: boolean
  pendingVerification?: boolean
  error?: AuthErrorKind
}

const ANON_SIGNIN_ATTEMPTS = 2
const RETRY_DELAY_MS = 800

let state: AccountState = { status: 'guest', userId: null, email: null }
const listeners = new Set<(s: AccountState) => void>()
let started = false

export function getAccountState(): AccountState {
  return state
}

export function subscribeAccount(fn: (s: AccountState) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function setState(next: AccountState) {
  state = next
  for (const fn of listeners) fn(state)
}

function applySession(session: Session | null) {
  const user = session?.user ?? null
  if (!user) {
    setState({ status: 'guest', userId: null, email: null })
    vaultRemove(VAULT_KEYS.session)
    return
  }
  if (user.is_anonymous) {
    setState({ status: 'anonymous', userId: user.id, email: null })
  } else {
    setState({ status: 'signedIn', userId: user.id, email: user.email ?? null })
  }
  // Mirror the refresh token so a localStorage wipe can be recovered.
  if (session) {
    try {
      vaultSet(
        VAULT_KEYS.session,
        JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }),
      )
    } catch {
      // best effort
    }
  }
}

/** Idempotent, fire-and-forget bootstrap: restore or create a session. */
export function initAccount(): void {
  if (started || !isSupabaseConfigured()) return
  started = true
  void bootstrap()
}

async function bootstrap(): Promise<void> {
  const client = await getSupabaseClient()
  client.auth.onAuthStateChange((_event, session) => applySession(session))
  await restoreOrCreateSession(client)
}

async function restoreOrCreateSession(
  client: Awaited<ReturnType<typeof getSupabaseClient>>,
): Promise<void> {
  try {
    const { data } = await client.auth.getSession()
    if (data.session) {
      // Keep the mirror fresh.
      applySession(data.session)
      return
    }
  } catch {
    // Fall through and try the vault / create an anonymous identity.
  }

  // localStorage may have been wiped; try the mirrored session first so we
  // don't mint a brand-new anonymous user while the 1-hour window is live.
  try {
    const raw = await vaultGet(VAULT_KEYS.session)
    if (raw) {
      const parsed = JSON.parse(raw) as { access_token?: string; refresh_token?: string }
      if (parsed.access_token && parsed.refresh_token) {
        const { data, error } = await client.auth.setSession({
          access_token: parsed.access_token,
          refresh_token: parsed.refresh_token,
        })
        if (!error && data.session) {
          applySession(data.session)
          return
        }
      }
    }
  } catch {
    // Fall through.
  }
  vaultRemove(VAULT_KEYS.session)

  await createAnonymousIdentity(client)
}

/** Anonymous sign-in with a small retry; stays guest when offline. */
async function createAnonymousIdentity(
  client: Awaited<ReturnType<typeof getSupabaseClient>>,
): Promise<void> {
  for (let attempt = 1; attempt <= ANON_SIGNIN_ATTEMPTS; attempt++) {
    try {
      const { data, error } = await client.auth.signInAnonymously()
      if (error) throw error
      if (data.session?.user) applySession(data.session)
      return
    } catch {
      if (attempt === ANON_SIGNIN_ATTEMPTS) return
      await delay(RETRY_DELAY_MS * attempt)
    }
  }
}

/** Bind the current account to an email identity; anonymous users keep their id. */
export async function bindEmail(email: string, password: string): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'network' }
  try {
    const client = await getSupabaseClient()
    const { data } = await client.auth.getSession()
    if (data.session?.user?.is_anonymous) {
      const res = await client.auth.updateUser({ email, password })
      if (res.error) return { ok: false, error: mapAuthError(res.error) }
      return { ok: true, pendingVerification: res.data.user?.new_email != null }
    }
    const res = await client.auth.signUp({ email, password })
    if (res.error) return { ok: false, error: mapAuthError(res.error) }
    const identities = res.data.user?.identities
    if (Array.isArray(identities) && identities.length === 0) {
      return { ok: false, error: 'email-taken' }
    }
    return { ok: true, pendingVerification: res.data.session == null }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'network' }
  try {
    const { error } = await (
      await getSupabaseClient()
    ).auth.signInWithPassword({ email, password })
    if (error) return { ok: false, error: mapAuthError(error) }
    return { ok: true }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function signOutAccount(): Promise<void> {
  if (!isSupabaseConfigured()) return
  let client: Awaited<ReturnType<typeof getSupabaseClient>> | null = null
  try {
    client = await getSupabaseClient()
    await client.auth.signOut()
  } catch {
    // Guest is the safe terminal state either way.
  }
  purgeLocalAuthSession()
  applySession(null)
  // Don't strand the player as a guest until the next reload.
  if (client) await createAnonymousIdentity(client)
}

/** Remove persisted Supabase auth rows (large sessions spill into chunks). */
function purgeLocalAuthSession(): void {
  try {
    const storage = globalThis.localStorage
    if (!storage) return
    const doomed: string[] = []
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key && /^sb-.*-auth-token(\.\d+)?$/.test(key)) doomed.push(key)
    }
    for (const key of doomed) storage.removeItem(key)
  } catch {
    // Private mode: nothing persisted, nothing to purge.
  }
}

export function mapAuthError(error: { status?: number; message?: string } | null): AuthErrorKind {
  if (!error) return 'unknown'
  const msg = (error.message ?? '').toLowerCase()
  if (error.status === 0 || /fetch|network|timeout/.test(msg)) return 'network'
  if (/rate limit|only request this after/.test(msg)) return 'rate-limited'
  if (/email not confirmed/.test(msg)) return 'email-unconfirmed'
  if (/invalid login|invalid credentials/.test(msg)) return 'invalid-credentials'
  if (/already registered|already exists/.test(msg)) return 'email-taken'
  if (/weak|at least \d+/.test(msg)) return 'weak-password'
  return 'unknown'
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
