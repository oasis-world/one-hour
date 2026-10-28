# one-hour · 一小时

> Language: **English** | [中文](README.zh-CN.md)

An ephemeral public chat room: **every message (text or photo) lives for exactly one hour, both locally and in the cloud.** When its hour runs out the message dissolves gracefully, and every player online watches it leave together. And this is a small experimental social product and exploring new ways to make social interactions more engaging with AI.

## Features

- 🕐 **One-hour lifecycle**: Every message (text or photo) exists for exactly one hour from send time. Each message carries a ring countdown (mm:ss) — amber in the last 10 minutes, red and pulsing in the last 2. When time runs out it blurs upward and folds away (`msg-dissolve`), removed from IndexedDB and the cloud at once, with other players seeing the same farewell over Realtime DELETE. The countdown's visual style can be switched from the settings menu (classic ring, soft progress line, fading segments, breathing light, gradient halo, orbiting dot, and more).

- 🖼️ **Image messages**: Desktop uploads via the `+` menu (multi-select up to 5, each becomes its own message); on touch devices `+` expands to "Take photo / Photo library", with the camera capturing directly. Photos are compressed in-browser (long edge 1440px, JPEG 0.82) with HEIC/HEIF auto-conversion; on weak/offline networks the image Blob travels with the text in the IndexedDB outbox and retries with backoff (per-file timeouts keep one stuck decode from blocking the rest). Tap any image to open the fullscreen viewer with swipe, pinch/double-tap zoom, pan, and vertical-fling dismiss. Images expire and are cleaned up with their message.

- 🌄 **Dynamic backdrop**: The fullscreen backdrop prefers the newest image in chat (synchronized across all clients, including its countdown); with no chat image it fetches a random photo (official Unsplash API when `VITE_UNSPLASH_ACCESS_KEY` is set, otherwise the keyless picsum Unsplash-sourced feed). Either way each backdrop photo stays at most one hour, then crossfades to a new one; a new chat image takes over immediately. The backdrop blurs while chat is open; tapping the top-right X folds the whole chat column (input included) into the bottom-left corner and the backdrop goes fully clear; tapping anywhere (or the bottom-left hint) unfolds it again. While folded, a ring-only countdown in the bottom-right shows the remaining backdrop slot, and a globe button opens the source photo.

- 🟢 **Realtime sync**: Supabase Realtime (postgres_changes INSERT/UPDATE/DELETE + presence) keeps new messages, edits, reactions, disappearances, and the online list in sync, with catch-up on reconnect and tab return.

## Quick start

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase project URL and key
npm run dev
```

### Supabase setup (one-time)

1. Create a Supabase project.
2. Run `supabase/schema.sql` in full in the SQL Editor:
   - Creates `chat_messages` (with `expires_at`, default `now() + 1 hour`) and RLS policies;
   - Creates `chat_reactions` (message emoji reactions) and `profiles` (nickname + avatar persisted across devices);
   - Creates the public-read, owner-folder-write `chat-images` Storage bucket;
   - Registers the Realtime publication (with `replica identity full` so UPDATE/DELETE payloads are complete);
   - Installs `pg_cron` to purge expired messages every minute (skips gracefully when unavailable; clients expire rows on their own);
   - Schedules the `purge-chat-images` Edge Function every 5 minutes to sweep orphaned photos (skips `avatar-*` persistent assets).
3. Dashboard → Authentication → Providers: enable **Anonymous sign-ins** (visitors get a stable identity automatically). Sign-up/sign-in uses email + password (if email confirmation is on, verify after binding).
4. (Optional, for the cron to call the Edge Function) Create Vault secrets in the SQL Editor: `project_url` and `purge_service_key` (service role key). The scheduling SQL in schema.sql skips when these are absent.
5. Put the Project Settings → API URL and publishable (anon) key into `.env.local` (`VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`; legacy `VITE_SUPABASE_ANON_KEY` still works).

> Without env vars the app still runs (single-machine mode): messages stay local and still vanish after one hour. The Unsplash Access Key is optional — without it the picsum Unsplash-sourced feed is used.

## Directory structure

```
src/
  lib/            # data layer (no React)
    chatSync.ts           # sync facade: optimistic writes + outbox retry + realtime merge + hourly sweep
    chatRemote.ts         # Supabase remote: paging / realtime channel / presence / image upload / reactions / edits
    chatCache.ts          # IndexedDB message cache
    chatOutbox.ts         # IndexedDB outbox (with image Blob)
    chatReactions.ts      # local reaction aggregation
    chatReactionRemote.ts # reaction persistence
    account.ts            # anonymous auto-login / email bind / login
    profileCloud.ts       # profile cloud sync
    userProfile.ts        # profile local state
    avatar.ts avatarStyles.ts avatarUpload.ts
    backgroundFeed.ts     # random backdrop source (Unsplash / picsum)
    countdownAnimations.ts # switchable countdown visuals
    expiry.ts             # one-hour rule: expiry calculation
    identity.ts nickname.ts
    i18n.ts translations.ts
    tick.ts               # shared 1s ticker
    settings.ts settingsRuntime.ts
    supabaseClient.ts supabaseConfig.ts
    ime.ts filePickerGuard.ts popoverGuard.ts withTimeout.ts media.ts
  components/     # UI
    App.tsx
    TopBar.tsx SettingsBar.tsx Composer.tsx
    MessageList.tsx MessageRow.tsx MessageMenu.tsx MsgHoverBar.tsx MsgReactions.tsx
    ImageViewer.tsx AccountDialog.tsx AccountPopover.tsx ProfilePage.tsx WelcomeModal.tsx
    BackgroundStage.tsx BgSlotRing.tsx CountdownRing.tsx CountdownVisual.tsx
    CountdownProgressRing.tsx CountdownAnimationPicker.tsx
    OnlineList.tsx OnlineTrigger.tsx LanguagePicker.tsx EmojiPanel.tsx
    useChatRoom.ts useChatScroll.ts
  styles/         # style segments
supabase/
  schema.sql
  functions/purge-chat-images/index.ts
```

---

[中文](README.zh-CN.md) · **English**
