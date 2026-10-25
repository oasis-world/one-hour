/**
 * Supabase connection settings, read once at module load (Vite inlines
 * VITE_* env at build time). The publishable key is a public browser value;
 * accept both the new sb_publishable_* and legacy anon naming.
 *
 * Unset values keep the app purely local: auth degrades to 'guest' and no
 * network call is ever attempted.
 */
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()

export const SUPABASE_ANON_KEY = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim()

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== ''
}
