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

-- Legacy single-row world state is fully retired. The open-world MUD
-- now lives in normalized tables below (worlds/regions/rooms/puzzles/...).
drop table if exists public.world_mud_state cascade;

-- ── Open World MUD (Tide Genesis) ─────────────────────────────────────
-- Shared persistent world: every new player joins the *current* progress
-- (solved seals, chronicle, realm leaderboard) instead of starting over.
-- Human players + AI co-build it: AI generates tasks/puzzles, humans solve
-- and cultivate (XP / realm level / equipment), and the AI Guide answers
-- questions with world context. All eternal tables below are NEVER purged
-- by the hourly chat purge; only the 1-hour chat tables are swept.

create table if not exists public.worlds (
  id text primary key,
  phase text not null default '启元期',
  epoch int not null default 1,
  solved_puzzles int not null default 0,
  total_puzzles int not null default 12,
  updated_at timestamptz not null default now()
);

create table if not exists public.regions (
  id text primary key,
  world_id text not null references public.worlds (id) on delete cascade,
  display_order int not null default 0,
  unlocked boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id text primary key,
  region_id text not null references public.regions (id) on delete cascade,
  world_id text not null default 'main',
  name_zh text,
  name_en text,
  exits jsonb not null default '{}'::jsonb,
  danger int not null default 0,
  richness int not null default 1,
  is_hidden boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists rooms_region_idx on public.rooms (region_id);

create table if not exists public.items (
  id text primary key,
  name text not null,
  name_en text,
  icon text not null default '✦',
  rarity text not null default 'common',
  slot text not null default 'pouch',
  description text,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.puzzles (
  id text primary key,
  room_id text not null references public.rooms (id) on delete cascade,
  region_id text not null references public.regions (id) on delete cascade,
  title text not null,
  riddle text not null,
  answer_hash text not null,
  hint text,
  reward_xp int not null default 20,
  reward_item_id text references public.items (id) on delete set null,
  status text not null default 'open',
  created_by uuid references auth.users (id) on delete set null,
  solver_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists puzzles_room_idx on public.puzzles (room_id);
create index if not exists puzzles_region_idx on public.puzzles (region_id);

create table if not exists public.player_tasks (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms (id) on delete cascade,
  region_id text not null references public.regions (id) on delete cascade,
  author_id uuid references auth.users (id) on delete cascade,
  prompt text not null,
  ai_title text not null,
  ai_desc text not null,
  reward_xp int not null default 15,
  reward_item_id text references public.items (id) on delete set null,
  status text not null default 'approved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists player_tasks_room_idx on public.player_tasks (room_id);

create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  realm_level int not null default 1,
  xp int not null default 0,
  realm_title text not null default '潮汐使徒',
  equipped jsonb not null default '{}'::jsonb,
  total_solved int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.player_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  puzzle_id text not null references public.puzzles (id) on delete cascade,
  solved_at timestamptz not null default now(),
  attempts int not null default 0,
  primary key (user_id, puzzle_id)
);

create table if not exists public.world_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  location_id text,
  action text not null,
  result text,
  kind text not null default 'action',
  lang text not null default 'zh',
  created_at timestamptz not null default now()
);
create index if not exists world_log_at_idx on public.world_log (at desc);
create index if not exists world_log_kind_idx on public.world_log (kind, at desc);

create table if not exists public.world_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  icon text not null default '✦',
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.player_help_qa (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  question text not null,
  ai_answer text not null,
  at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists player_help_qa_user_idx on public.player_help_qa (user_id, at desc);

-- RLS: readable by every signed-in player (shared world is public to the room).
alter table public.worlds enable row level security;
alter table public.regions enable row level security;
alter table public.rooms enable row level security;
alter table public.items enable row level security;
alter table public.puzzles enable row level security;
alter table public.player_tasks enable row level security;
alter table public.player_profiles enable row level security;
alter table public.player_progress enable row level security;
alter table public.world_log enable row level security;
alter table public.world_events enable row level security;
alter table public.player_help_qa enable row level security;

drop policy if exists "worlds readable by signed-in players" on public.worlds;
create policy "worlds readable by signed-in players" on public.worlds for select using (auth.uid() is not null);
drop policy if exists "signed-in players may update worlds" on public.worlds;
create policy "signed-in players may update worlds" on public.worlds for update using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "signed-in players may create worlds" on public.worlds;
create policy "signed-in players may create worlds" on public.worlds for insert with check (auth.uid() is not null);

drop policy if exists "regions readable by signed-in players" on public.regions;
create policy "regions readable by signed-in players" on public.regions for select using (auth.uid() is not null);
drop policy if exists "signed-in players may create regions" on public.regions;
create policy "signed-in players may create regions" on public.regions for insert with check (auth.uid() is not null);
drop policy if exists "signed-in players may update regions" on public.regions;
create policy "signed-in players may update regions" on public.regions for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "rooms readable by signed-in players" on public.rooms;
create policy "rooms readable by signed-in players" on public.rooms for select using (auth.uid() is not null);
drop policy if exists "signed-in players may create rooms" on public.rooms;
create policy "signed-in players may create rooms" on public.rooms for insert with check (auth.uid() is not null);
drop policy if exists "signed-in players may update rooms" on public.rooms;
create policy "signed-in players may update rooms" on public.rooms for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "items readable by signed-in players" on public.items;
create policy "items readable by signed-in players" on public.items for select using (auth.uid() is not null);
drop policy if exists "signed-in players may create items" on public.items;
create policy "signed-in players may create items" on public.items for insert with check (auth.uid() is not null);
drop policy if exists "signed-in players may update items" on public.items;
create policy "signed-in players may update items" on public.items for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "puzzles readable by signed-in players" on public.puzzles;
create policy "puzzles readable by signed-in players" on public.puzzles for select using (auth.uid() is not null);
drop policy if exists "signed-in players may create puzzles" on public.puzzles;
create policy "signed-in players may create puzzles" on public.puzzles for insert with check (auth.uid() is not null);
drop policy if exists "signed-in players may update puzzles" on public.puzzles;
create policy "signed-in players may update puzzles" on public.puzzles for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "player tasks readable by signed-in players" on public.player_tasks;
create policy "player tasks readable by signed-in players" on public.player_tasks for select using (auth.uid() is not null);
drop policy if exists "signed-in players may create tasks" on public.player_tasks;
create policy "signed-in players may create tasks" on public.player_tasks for insert with check (auth.uid() is not null);
drop policy if exists "task authors may update tasks" on public.player_tasks;
create policy "task authors may update tasks" on public.player_tasks for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
drop policy if exists "signed-in players may approve tasks" on public.player_tasks;
create policy "signed-in players may approve tasks" on public.player_tasks for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "player profiles readable by signed-in players" on public.player_profiles;
create policy "player profiles readable by signed-in players" on public.player_profiles for select using (auth.uid() is not null);
drop policy if exists "players may insert own cultivation profile" on public.player_profiles;
create policy "players may insert own cultivation profile" on public.player_profiles for insert with check (auth.uid() = user_id);
drop policy if exists "players may update own cultivation profile" on public.player_profiles;
create policy "players may update own cultivation profile" on public.player_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "progress readable by signed-in players" on public.player_progress;
create policy "progress readable by signed-in players" on public.player_progress for select using (auth.uid() is not null);
drop policy if exists "players may record own progress" on public.player_progress;
create policy "players may record own progress" on public.player_progress for insert with check (auth.uid() = user_id);
drop policy if exists "players may update own progress" on public.player_progress;
create policy "players may update own progress" on public.player_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "world log readable by signed-in players" on public.world_log;
create policy "world log readable by signed-in players" on public.world_log for select using (auth.uid() is not null);
drop policy if exists "signed-in players may append world log" on public.world_log;
create policy "signed-in players may append world log" on public.world_log for insert with check (auth.uid() is not null);

drop policy if exists "world events readable by signed-in players" on public.world_events;
create policy "world events readable by signed-in players" on public.world_events for select using (auth.uid() is not null);
drop policy if exists "signed-in players may create world events" on public.world_events;
create policy "signed-in players may create world events" on public.world_events for insert with check (auth.uid() is not null);
drop policy if exists "signed-in players may update world events" on public.world_events;
create policy "signed-in players may update world events" on public.world_events for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "help qa readable by owner" on public.player_help_qa;
create policy "help qa readable by owner" on public.player_help_qa for select using (auth.uid() is not null);
drop policy if exists "players may ask help" on public.player_help_qa;
create policy "players may ask help" on public.player_help_qa for insert with check (auth.uid() = user_id);
drop policy if exists "players may update own help" on public.player_help_qa;
create policy "players may update own help" on public.player_help_qa for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.worlds to authenticated;
grant select, insert, update on public.regions to authenticated;
grant select, insert, update on public.rooms to authenticated;
grant select, insert, update on public.items to authenticated;
grant select, insert, update on public.puzzles to authenticated;
grant select, insert, update on public.player_tasks to authenticated;
grant select, insert, update on public.player_profiles to authenticated;
grant select, insert, update on public.player_progress to authenticated;
grant select, insert on public.world_log to authenticated;
grant select, insert, update on public.world_events to authenticated;
grant select, insert, update on public.player_help_qa to authenticated;
revoke all on public.worlds, public.regions, public.rooms, public.items, public.puzzles, public.player_tasks, public.player_profiles, public.player_progress, public.world_log, public.world_events, public.player_help_qa from anon;

do $$
begin
  alter publication supabase_realtime add table public.worlds;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.world_log;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.player_profiles;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.player_tasks;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.puzzles;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.world_events;
exception when duplicate_object then null;
end $$;

-- Seed: the shared world exists even before any player acts, so a new
-- player always lands on the *current* progress, not a blank slate.
insert into public.worlds (id, phase, epoch, total_puzzles) values ('main', '启元期', 1, 12) on conflict (id) do nothing;
insert into public.regions (id, world_id, display_order, unlocked) values
  ('plaza', 'main', 0, true), ('tavern', 'main', 1, true), ('forest', 'main', 2, true),
  ('city', 'main', 3, true), ('ruin', 'main', 4, true), ('lab', 'main', 5, true),
  ('ocean', 'main', 6, true), ('academy', 'main', 7, true)
on conflict (id) do nothing;
insert into public.items (id, name, name_en, icon, rarity, slot, description, stats) values
  ('item-tide-blade', '汐刃', 'Tide Blade', '🗡️', 'rare', 'weapon', '引汐成刃，xian 汐力 +15', '{"attack":15}'::jsonb),
  ('item-dawn-amulet', '破晓护符', 'Dawn Amulet', '🛡️', 'rare', 'amulet', '护符微光，防御 +12', '{"defense":12}'::jsonb),
  ('item-star-compass', '星引罗盘', 'Star Compass', '🧭', 'epic', 'compass', '指引封印方位，探索 +10', '{"explore":10}'::jsonb),
  ('item-tide-pouch', '潮痕囊', 'Tide Pouch', '🎒', 'common', 'pouch', '收纳潮汐碎片', '{"capacity":20}'::jsonb),
  ('item-abyss-lantern', '渊灯', 'Abyss Lantern', '🔦', 'epic', 'compass', '照亮深渊裂隙', '{"light":15}'::jsonb),
  ('item-gold-key', '金钥', 'Golden Key', '🔑', 'legendary', 'pouch', '打开禁书库的钥匙', '{"key":1}'::jsonb),
  ('item-moon-vial', '月光药剂', 'Moonlight Vial', '🧪', 'common', 'pouch', '恢复汐力', '{"heal":20}'::jsonb),
  ('item-tide-core', '汐核', 'Tide Core', '💠', 'legendary', 'amulet', '启元期核心碎片', '{"core":1}'::jsonb)
on conflict (id) do nothing;
insert into public.world_events (title, description, icon) values
  ('潮汐初醒', '八域封印松动，潮汐使徒们踏入世界共同开凿封印。', '🌊')
on conflict do nothing;

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
