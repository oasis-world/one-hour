-- ============================================================
-- 一小时 / one-hour — Supabase schema
-- Run once in the Supabase dashboard → SQL Editor.
--
-- One global ephemeral chat room: every row carries expires_at
-- (normally created_at + 1 hour; farewell notes use 10 minutes). Clients hide and delete expired rows; the
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
  author_role text, -- role/title snapshot for expired anonymous authors
  content text not null default '' check (char_length(content) <= 1000),
  reply_to jsonb, -- snapshot of the message being replied to
  image_url text, -- public storage URL of the attached photo, null for text-only
  edited_at timestamptz, -- set when the author edits the message text
  farewell boolean not null default false, -- goodbye message (special background)
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  constraint chat_messages_has_payload
    check (char_length(content) > 0 or image_url is not null)
);

-- Existing deployments: add the avatar columns in place.
alter table public.chat_messages add column if not exists avatar_style text;
alter table public.chat_messages add column if not exists avatar_seed text;
alter table public.chat_messages add column if not exists avatar_url text;
alter table public.chat_messages add column if not exists author_role text;
alter table public.chat_messages add column if not exists reply_to jsonb;
alter table public.chat_messages add column if not exists edited_at timestamptz;
alter table public.chat_messages add column if not exists farewell boolean not null default false;
alter table public.chat_messages add column if not exists whisper_to uuid references auth.users (id) on delete cascade;
alter table public.chat_messages add column if not exists whisper_to_name text;

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

create index if not exists chat_messages_whisper
  on public.chat_messages (whisper_to);

alter table public.chat_messages enable row level security;

-- Public messages are readable by all signed-in players; whisper messages
-- are only visible to their sender and recipient.
drop policy if exists "chat is readable by signed-in players"
  on public.chat_messages;

create policy "chat is readable by signed-in players"
  on public.chat_messages for select
  using (
    auth.uid() is not null
    and (
      whisper_to is null
      or whisper_to = auth.uid()
      or user_id = auth.uid()
    )
  );

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

-- ── Polls: one live vote per card message (1-hour lifecycle) ─────────
--
-- A poll lives as a chat message whose content carries __POLL__:<poll_id>.
-- The polls row is the question/options ballot; poll_votes is the ballot
-- box (one row per pick, so multi-pick polls hold several rows per
-- voter). Both expire with the card message: the purge sweeps expired
-- rows plus rows whose card has vanished (same orphan rule as games).

create table if not exists public.polls (
  poll_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  question text not null check (char_length(question) between 1 and 120),
  options jsonb not null check (jsonb_typeof(options) = 'array'),
  multiple boolean not null default false,
  closed_at timestamptz, -- creator closed the ballot early
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour')
);

create index if not exists polls_expiry on public.polls (expires_at);
alter table public.polls enable row level security;

drop policy if exists "polls are readable by signed-in players"
  on public.polls;
create policy "polls are readable by signed-in players"
  on public.polls for select
  using (auth.uid() is not null);

drop policy if exists "players may create their own polls"
  on public.polls;
create policy "players may create their own polls"
  on public.polls for insert
  with check (auth.uid() = user_id);

drop policy if exists "poll owners may close their own polls"
  on public.polls;
create policy "poll owners may close their own polls"
  on public.polls for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "poll owners may delete their own polls"
  on public.polls;
create policy "poll owners may delete their own polls"
  on public.polls for delete
  using (auth.uid() = user_id);

create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls (poll_id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  option_index int not null check (option_index >= 0 and option_index < 8),
  display_name text, -- voter name snapshot (presence may have left)
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id, option_index)
);

create index if not exists poll_votes_poll on public.poll_votes (poll_id);
alter table public.poll_votes enable row level security;

drop policy if exists "poll votes are readable by signed-in players"
  on public.poll_votes;
create policy "poll votes are readable by signed-in players"
  on public.poll_votes for select
  using (auth.uid() is not null);

drop policy if exists "players may cast their own votes"
  on public.poll_votes;
create policy "players may cast their own votes"
  on public.poll_votes for insert
  with check (auth.uid() = user_id);

drop policy if exists "players may change their own votes"
  on public.poll_votes;
create policy "players may change their own votes"
  on public.poll_votes for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.polls to authenticated;
grant select, insert, delete on public.poll_votes to authenticated;
revoke all on public.polls, public.poll_votes from anon;

do $$
begin
  alter publication supabase_realtime add table public.polls;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.poll_votes;
exception
  when duplicate_object then null;
end $$;

-- ── Gomoku game state ──────────────────────────────────────────────────────
-- Broadcasts keep an active board in sync; this row restores it after refresh.
-- Saved state expires one hour after its most recent move or player change.

create table if not exists public.gomoku_states (
  instance_id text primary key,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour')
);

create index if not exists gomoku_states_expiry on public.gomoku_states (expires_at);
alter table public.gomoku_states enable row level security;

drop policy if exists "game states are readable by signed-in players" on public.gomoku_states;
create policy "game states are readable by signed-in players"
  on public.gomoku_states for select using (auth.uid() is not null);

drop policy if exists "signed-in players may create game states" on public.gomoku_states;
create policy "signed-in players may create game states"
  on public.gomoku_states for insert with check (auth.uid() is not null);

drop policy if exists "signed-in players may update game states" on public.gomoku_states;
create policy "signed-in players may update game states"
  on public.gomoku_states for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "expired game states may be removed by signed-in players" on public.gomoku_states;
drop policy if exists "signed-in players may delete game states" on public.gomoku_states;
create policy "signed-in players may delete game states"
  on public.gomoku_states for delete
  using (auth.uid() is not null);

grant select, insert, update, delete on public.gomoku_states to authenticated;
revoke all on public.gomoku_states from anon;

-- ── Xiangqi game state ──────────────────────────────────────────────────────

create table if not exists public.xiangqi_states (
  instance_id text primary key,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour')
);

create index if not exists xiangqi_states_expiry on public.xiangqi_states (expires_at);
alter table public.xiangqi_states enable row level security;

drop policy if exists "xiangqi states are readable by signed-in players" on public.xiangqi_states;
create policy "xiangqi states are readable by signed-in players"
  on public.xiangqi_states for select using (auth.uid() is not null);

drop policy if exists "signed-in players may create xiangqi states" on public.xiangqi_states;
create policy "signed-in players may create xiangqi states"
  on public.xiangqi_states for insert with check (auth.uid() is not null);

drop policy if exists "signed-in players may update xiangqi states" on public.xiangqi_states;
create policy "signed-in players may update xiangqi states"
  on public.xiangqi_states for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "signed-in players may delete xiangqi states" on public.xiangqi_states;
create policy "signed-in players may delete xiangqi states"
  on public.xiangqi_states for delete
  using (auth.uid() is not null);

grant select, insert, update, delete on public.xiangqi_states to authenticated;
revoke all on public.xiangqi_states from anon;

-- ── Chess game state ───────────────────────────────────────────────────────
create table if not exists public.chess_states (
  instance_id text primary key,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour')
);
create index if not exists chess_states_expiry on public.chess_states (expires_at);
alter table public.chess_states enable row level security;
drop policy if exists "chess states are readable by signed-in players" on public.chess_states;
create policy "chess states are readable by signed-in players" on public.chess_states for select using (auth.uid() is not null);
drop policy if exists "signed-in players may create chess states" on public.chess_states;
create policy "signed-in players may create chess states" on public.chess_states for insert with check (auth.uid() is not null);
drop policy if exists "signed-in players may update chess states" on public.chess_states;
create policy "signed-in players may update chess states" on public.chess_states for update using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "signed-in players may delete chess states" on public.chess_states;
create policy "signed-in players may delete chess states" on public.chess_states for delete using (auth.uid() is not null);
grant select, insert, update, delete on public.chess_states to authenticated;
revoke all on public.chess_states from anon;

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
  delete from public.chat_messages m
  where m.expires_at <= now()
     or (coalesce(m.farewell, false) and m.created_at <= now() - interval '10 minutes')
     or (
       not coalesce(m.farewell, false)
       and exists (
         select 1 from public.profiles p
         where p.user_id = m.user_id
           and p.expires_at is not null
           and p.expires_at <= now()
       )
     );
  delete from public.gomoku_states where expires_at <= now();
  delete from public.xiangqi_states where expires_at <= now();
  delete from public.chess_states where expires_at <= now();
  -- Purge expired anonymous profiles (and their now-orphaned messages were
  -- already removed above). Signed-in profiles have expires_at IS NULL and
  -- are never touched here.
  delete from public.profiles
   where expires_at is not null
     and expires_at <= now();
  -- Drop game states whose card message is gone (expired or author vanished).
  delete from public.gomoku_states gs
  where not exists (
    select 1 from public.chat_messages cm
    where cm.content like '%' || gs.instance_id || '%'
  );
  delete from public.xiangqi_states xs
  where not exists (
    select 1 from public.chat_messages cm
    where cm.content like '%' || xs.instance_id || '%'
  );
  delete from public.chess_states cs
  where not exists (
    select 1 from public.chat_messages cm
    where cm.content like '%' || cs.instance_id || '%'
  );
  -- Polls share the card message's one-hour life: expired rows go, and so
  -- do orphans whose card vanished (author delete / edit). Votes cascade.
  delete from public.polls p
  where p.expires_at <= now()
     or not exists (
       select 1 from public.chat_messages cm
       where cm.content like '%' || p.poll_id::text || '%'
     );
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
-- Written for anonymous visitors (expires_at set, ~1 hour) and for players
-- who bind an email (expires_at NULL, never expires). The hourly purge
-- sweeps expired anonymous rows; signed-in rows are never touched.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 40),
  avatar_style text not null check (char_length(avatar_style) between 1 and 40),
  avatar_seed text not null check (char_length(avatar_seed) between 1 and 64),
  avatar_url text, -- custom photo avatar (public storage URL)
  role text, -- free-text role/title
  expires_at timestamptz, -- anonymous identity expiry (1 hour); synced on refresh
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists role text;
alter table public.profiles add column if not exists expires_at timestamptz;

create index if not exists profiles_expiry on public.profiles (expires_at);

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

drop policy if exists "players may delete their own profile"
  on public.profiles;
create policy "players may delete their own profile"
  on public.profiles for delete
  using (auth.uid() = user_id);

create or replace function public.delete_profile_messages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.chat_messages where user_id = old.user_id and expires_at <= now();
  return old;
end;
$$;

drop trigger if exists delete_profile_messages on public.profiles;
create trigger delete_profile_messages
  after delete on public.profiles
  for each row execute function public.delete_profile_messages();

-- ── Star points ─────────────────────────────────────────────────────────────
-- The balance is separate from the expiring profile so a recipient keeps
-- gifted points even after the giver's one-hour profile is removed.

create table if not exists public.star_points (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 100 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.star_point_transfers (
  sender_id uuid not null references auth.users (id) on delete cascade,
  transfer_id text not null,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  primary key (sender_id, transfer_id),
  check (sender_id <> recipient_id)
);

alter table public.star_points enable row level security;
drop policy if exists "players may read their own star points" on public.star_points;
create policy "players may read their own star points" on public.star_points
  for select using (auth.uid() = user_id);
grant select on public.star_points to authenticated;
revoke insert, update, delete on public.star_points from authenticated;
revoke all on public.star_point_transfers from anon, authenticated;

create or replace function public.ensure_star_points()
returns integer language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); result integer;
begin
  if uid is null then raise exception 'authentication required'; end if;
  insert into public.star_points (user_id) values (uid) on conflict (user_id) do nothing;
  select balance into result from public.star_points where user_id = uid;
  return result;
end;
$$;

create or replace function public.change_star_points(p_delta integer)
returns integer language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); result integer;
begin
  if uid is null then raise exception 'authentication required'; end if;
  if p_delta is null or abs(p_delta) > 1000000 then raise exception 'invalid point change'; end if;
  insert into public.star_points (user_id) values (uid) on conflict (user_id) do nothing;
  update public.star_points set balance = balance + p_delta, updated_at = now()
    where user_id = uid and balance + p_delta >= 0 returning balance into result;
  if result is null then raise exception 'insufficient star points'; end if;
  return result;
end;
$$;

create or replace function public.transfer_star_points(p_transfer_id text, p_recipient uuid, p_amount integer)
returns boolean language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); sender_balance integer;
begin
  if uid is null then raise exception 'authentication required'; end if;
  if p_recipient is null or p_recipient = uid or p_amount is null or p_amount <= 0
    or char_length(p_transfer_id) not between 1 and 160 then raise exception 'invalid point transfer'; end if;
  insert into public.star_points (user_id) values (uid) on conflict (user_id) do nothing;
  insert into public.star_points (user_id) values (p_recipient) on conflict (user_id) do nothing;
  perform 1 from public.star_points where user_id in (uid, p_recipient) order by user_id for update;
  insert into public.star_point_transfers (sender_id, transfer_id, recipient_id, amount)
    values (uid, p_transfer_id, p_recipient, p_amount) on conflict (sender_id, transfer_id) do nothing;
  if not found then return true; end if;
  update public.star_points set balance = balance - p_amount, updated_at = now()
    where user_id = uid and balance >= p_amount returning balance into sender_balance;
  if sender_balance is null then raise exception 'insufficient star points'; end if;
  update public.star_points set balance = balance + p_amount, updated_at = now() where user_id = p_recipient;
  return true;
end;
$$;

revoke all on function public.ensure_star_points() from public, anon;
revoke all on function public.change_star_points(integer) from public, anon;
revoke all on function public.transfer_star_points(text, uuid, integer) from public, anon;
grant execute on function public.ensure_star_points() to authenticated;
grant execute on function public.change_star_points(integer) to authenticated;
grant execute on function public.transfer_star_points(text, uuid, integer) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.star_points;
exception when duplicate_object then null;
end $$;

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
