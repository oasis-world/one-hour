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
  avatar_style text, -- dicebear style name captured at send time
  avatar_seed text, -- dicebear seed captured at send time
  avatar_url text, -- custom photo avatar URL captured at send time
  content text not null default '' check (char_length(content) <= 1000),
  reply_to jsonb, -- snapshot of the message being replied to
  image_url text, -- public storage URL of the attached photo, null for text-only
  edited_at timestamptz, -- set when the author edits the message text
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  constraint chat_messages_has_payload
    check (char_length(content) > 0 or image_url is not null)
);

-- Existing deployments: add the avatar columns in place.
alter table public.chat_messages add column if not exists avatar_style text;
alter table public.chat_messages add column if not exists avatar_seed text;
alter table public.chat_messages add column if not exists avatar_url text;
alter table public.chat_messages add column if not exists reply_to jsonb;
alter table public.chat_messages add column if not exists edited_at timestamptz;

-- Full replica identity so Realtime UPDATE/DELETE payloads carry every column
-- (including edited_at) instead of just the primary key.
alter table public.chat_messages replica identity full;

-- Existing deployments: raise the message length cap 500 → 1000.
alter table public.chat_messages drop constraint if exists chat_messages_content_check;
alter table public.chat_messages add constraint chat_messages_content_check
  check (char_length(content) <= 1000);

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

-- Authors may edit their own messages in place.
drop policy if exists "players may update their own messages"
  on public.chat_messages;
create policy "players may update their own messages"
  on public.chat_messages for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Feed the Realtime postgres_changes subscription the app listens to.
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null; -- already in the publication
end $$;

-- ── Shared message reactions ────────────────────────────────────────────────

create table if not exists public.chat_reactions (
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists chat_reactions_message
  on public.chat_reactions (message_id);

alter table public.chat_reactions enable row level security;

drop policy if exists "reactions are readable by signed-in players"
  on public.chat_reactions;
create policy "reactions are readable by signed-in players"
  on public.chat_reactions for select
  using (auth.uid() is not null);

drop policy if exists "players may add their own reactions"
  on public.chat_reactions;
create policy "players may add their own reactions"
  on public.chat_reactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "players may remove their own reactions"
  on public.chat_reactions;
create policy "players may remove their own reactions"
  on public.chat_reactions for delete
  using (auth.uid() = user_id);

grant select, insert, delete on public.chat_reactions to authenticated;
revoke all on public.chat_reactions from anon;

do $$
begin
  alter publication supabase_realtime add table public.chat_reactions;
exception
  when duplicate_object then null;
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
-- minute via pg_cron; every connected client also calls it as a
-- fallback (the function is granted to authenticated).
--
-- Photo objects are NOT swept here: Supabase blocks direct deletes on
-- storage.objects ("use the Storage API"), and a raising statement
-- would roll the whole function back — messages included. Photos are
-- cleaned in two layers instead:
--  1. the author's own client removes its object via the Storage API
--     as the row expires or is deleted (chatRemote.deleteMessage);
--  2. the scheduled Edge Function supabase/functions/purge-chat-images
--     (service role) sweeps the bucket for orphaned photos, skipping
--     avatar-* profile assets — schedule it every few minutes in the
--     Dashboard (Edge Functions → Schedules).

create or replace function public.purge_expired_chat_messages()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.chat_messages where expires_at <= now();
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

-- ── Player profiles ─────────────────────────────────────────────────────────
--
-- Nickname + DiceBear look (style name + seed, rendered client-side).
-- Written only for players who bind an email; the same row restores the
-- face on every device after sign-in. Never expires.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 40),
  avatar_style text not null check (char_length(avatar_style) between 1 and 40),
  avatar_seed text not null check (char_length(avatar_seed) between 1 and 64),
  avatar_url text, -- custom photo avatar (public storage URL)
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists avatar_url text;

alter table public.profiles enable row level security;

-- Readable by every signed-in player so future surfaces can show faces.
drop policy if exists "profiles are readable by signed-in players"
  on public.profiles;

create policy "profiles are readable by signed-in players"
  on public.profiles for select
  using (auth.uid() is not null);

-- Writes bind to the caller's JWT (upsert needs both insert + update).
drop policy if exists "players may insert their own profile"
  on public.profiles;

create policy "players may insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "players may update their own profile"
  on public.profiles;

create policy "players may update their own profile"
  on public.profiles for update
  using (auth.uid() = user_id);

-- ── Scheduled bucket sweep (Edge Function) ─────────────────────────────────
--
-- Photos of vanished authors are swept by the Edge Function
-- supabase/functions/purge-chat-images. One-time setup in the SQL editor
-- (the service_role key lives only in Vault — never in this file):
--   create extension if not exists pg_net;
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service_role_key>', 'purge_service_key');

do $$
begin
  perform cron.unschedule('purge-chat-images');
exception
  when others then null; -- not scheduled yet
end $$;

do $$
begin
  perform cron.schedule(
    'purge-chat-images',
    '*/5 * * * *',
    $sql$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
             || '/functions/v1/purge-chat-images',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'purge_service_key')
      ),
      body := '{}'::jsonb
    );
    $sql$
  );
exception
  when others then null; -- pg_net absent or vault secrets not set up yet
end $$;
