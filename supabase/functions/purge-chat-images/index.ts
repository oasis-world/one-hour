// 一小时 / one-hour — scheduled bucket sweeper.
//
// The SQL purge (purge_expired_chat_messages) only deletes message rows:
// Supabase blocks direct deletes on storage.objects, and authors' clients
// remove their own photos through the Storage API as their rows expire.
// This function is the safety net for authors who never came back: it
// walks the chat-images bucket and removes every photo object that is
// (a) not an avatar (avatar-* files are persistent profile assets),
// (b) older than a message lifetime, and
// (c) not referenced by any live (unexpired) message row.
//
// Deploy:  supabase functions deploy purge-chat-images
// Schedule (Dashboard → Edge Functions → purge-chat-images → Schedules):
//          every 5 minutes. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are
// injected by the platform; verify_jwt stays on, so only the platform
// (schedule) or a service-role caller can invoke it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUCKET = 'chat-images'
const AVATAR_PREFIX = 'avatar-'
/** Message lifetime + the outbox retry window, plus a small buffer. */
const MIN_AGE_MS = 65 * 60 * 1000
const PAGE = 1000

function objectPathOf(imageUrl: string): string {
  const marker = `${BUCKET}/`
  const idx = imageUrl.indexOf(marker)
  return idx === -1 ? '' : imageUrl.slice(idx + marker.length)
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async () => {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return json({ error: 'missing env' }, 500)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // Live references: every photo a not-yet-expired row still points at.
  const { data: rows, error: rowsError } = await admin
    .from('chat_messages')
    .select('image_url')
    .not('image_url', 'is', null)
    .gt('expires_at', new Date().toISOString())
  if (rowsError) return json({ error: rowsError.message }, 500)
  const live = new Set(
    (rows ?? []).map((r) => objectPathOf(r.image_url as string)).filter(Boolean),
  )

  // Walk the bucket: one folder per player id, avatar-* skipped inside.
  const cutoff = Date.now() - MIN_AGE_MS
  const doomed: string[] = []
  const { data: folders } = await admin.storage
    .from(BUCKET)
    .list(undefined, { limit: PAGE, sortBy: { column: 'name', order: 'asc' } })
  for (const folder of folders ?? []) {
    if (folder.id !== null) continue // root-level files are not ours
    const { data: files } = await admin.storage
      .from(BUCKET)
      .list(folder.name, { limit: PAGE })
    for (const file of files ?? []) {
      const path = `${folder.name}/${file.name}`
      if (file.name.startsWith(AVATAR_PREFIX)) continue
      if (new Date(file.created_at ?? 0).getTime() > cutoff) continue
      if (live.has(path)) continue
      doomed.push(path)
    }
  }

  let removed = 0
  for (let i = 0; i < doomed.length; i += 100) {
    const { data } = await admin.storage.from(BUCKET).remove(doomed.slice(i, i + 100))
    removed += data?.length ?? 0
  }
  return json({ removed, candidates: doomed.length, liveReferences: live.size })
})
