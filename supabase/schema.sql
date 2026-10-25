-- ============================================================
-- 一小时 / one-hour — Supabase schema
-- Run once in the Supabase dashboard → SQL Editor.
--
-- One global ephemeral chat room: every row carries expires_at
-- (created_at + 1 hour). Clients hide and delete expired rows; the
-- pg_cron job below purges them server-side every minute so the cloud
-- truly forgets even if an author never returns online.
-- ============================================================

-- ── Messages ────────────────────────────────────────────────────────────────

create table if not exists public.chat_messages (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  content text not null default '' check (char_length(content) <= 500),
  image_url text, -- public storage URL of the attached photo, null for text-only
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  constraint chat_messages_has_payload
    check (char_length(content) > 0 or image_url is not null)
);

create index if not exists chat_messages_recent
  on public.chat_messages (created_at desc);

-- Plain expiry index for the purge delete. (No partial index here: a
-- `where expires_at > now()` predicate is illegal — now() is STABLE and
-- index predicates require IMMUTABLE functions.)
create index if not exists chat_messages_expiry
  on public.chat_messages (expires_at);

alter table public.chat_messages enable row level security;

-- Readable by every signed-in player (anonymous sign-ins included): the
-- room is public, that wider policy is the whole point.
drop policy if exists "chat is readable by signed-in players"
  on public.chat_messages;

create policy "chat is readable by signed-in players"
  on public.chat_messages for select
  using (auth.uid() is not null);

-- Writes bind to the caller's JWT no matter what the payload claims.
drop policy if exists "players may post as themselves"
  on public.chat_messages;

create policy "players may post as themselves"
  on public.chat_messages for insert
  with check (auth.uid() = user_id);

-- Authors (and the hourly expiry sweep on their behalf) may delete rows.
drop policy if exists "players may delete their own messages"
  on public.chat_messages;

create policy "players may delete their own messages"
  on public.chat_messages for delete
  using (auth.uid() = user_id);

-- Feed the Realtime postgres_changes subscription the app listens to.
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null; -- already in the publication
end $$;

-- ── Chat image bucket ───────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

drop policy if exists "chat images are publicly readable"
  on storage.objects;

create policy "chat images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'chat-images');

-- Writes land under a folder named after the caller's uid only.
drop policy if exists "chat images are writable by their owner folder"
  on storage.objects;

create policy "chat images are writable by their owner folder"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "chat images are updatable by their owner folder"
  on storage.objects;

create policy "chat images are updatable by their owner folder"
  on storage.objects for update
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "chat images are deletable by their owner folder"
  on storage.objects;

create policy "chat images are deletable by their owner folder"
  on storage.objects for delete
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── The one-hour purge ──────────────────────────────────────────────────────
--
-- SECURITY DEFINER so the cron job can sweep every author's rows (RLS
-- would otherwise only let each player delete their own). Runs every
-- minute via pg_cron; every connected client then receives the DELETE
-- broadcast and plays the same farewell animation it would for its own
-- expiry. Storage objects are removed with the rows.

create or replace function public.purge_expired_chat_messages()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.chat_messages where expires_at <= now();
  -- Images lag behind by 2h (past any message lifetime, and safely past
  -- the upload→insert window) so fresh uploads never race the sweep.
  delete from storage.objects
  where bucket_id = 'chat-images'
    and created_at < now() - interval '2 hours';
end;
$$;

revoke all on function public.purge_expired_chat_messages() from public, anon;
grant execute on function public.purge_expired_chat_messages() to authenticated;

-- Schedule the sweep; extension unavailable on some plans → each block
-- fails soft and the file stays runnable (clients expire rows on their own).
do $$
begin
  create extension if not exists pg_cron;
exception
  when others then null;
end $$;

do $$
begin
  perform cron.unschedule('purge-expired-chat-messages');
exception
  when others then null; -- job not scheduled yet, or pg_cron absent
end $$;

do $$
begin
  perform cron.schedule(
    'purge-expired-chat-messages',
    '* * * * *',
    $sql$ select public.purge_expired_chat_messages(); $sql$
  );
exception
  when others then null; -- pg_cron absent: skip, client-side expiry still holds
end $$;
