<a id="中文"></a>

# 一小时 · one-hour

> Language: **中文** · [English](#english)

一个 ephemeral public chat room: **every message (text or photo) lives for exactly one hour, both locally and in the cloud.** When its hour runs out the message dissolves gracefully, and every player online watches it leave together.

## 功能

- 🕐 **一小时生命周期**：每条消息（文字或图片）从发送起只存在 1 小时；消息旁有环形倒计时（mm:ss），最后 10 分钟变琥珀色、最后 2 分钟红色脉动；归零时消息模糊上浮、折叠消失（`msg-dissolve` 动画），本地 IndexedDB 与云端同时删除，其它玩家通过 Realtime DELETE 同步看到。倒计时的视觉样式可在设置菜单中自由切换（经典圆环、轻盈进度线、渐隐刻度、呼吸光点、渐变光环、轨道光点等）。
- 🖼️ **图片消息**：桌面端通过 `+` 菜单上传图片（支持多选，最多 5 张，每张作为独立消息）；触屏设备 `+` 自动展开为「拍照 / 从相册选择」，拍照直接调起后置摄像头。发送前在浏览器内压缩（长边 1440px / JPEG 0.82），并兼容 HEIC/HEIF 相册格式（自动转码）；弱网/断网时图片 Blob 与文字一起进入 IndexedDB outbox，指数退避自动重试，单文件超时保护避免卡死。点击消息图片可全屏查看，支持左右滑动切换、双击/捏合缩放、拖拽平移与垂直滑动关闭。图片随消息一小时后自动过期并清理。
- 🌄 **动态背景**：全屏背景优先显示聊天里最新一张图片（所有客户端同步同一张图与倒计时）；聊天里没有图片时自动从随机图源取一张（配置 `VITE_UNSPLASH_ACCESS_KEY` 使用 Unsplash 官方 API，未配置时使用 picsum 的 Unsplash 图源，开箱即用）。无论来源，每张背景图最多展示 1 小时，到时自动淡出换新；新的聊天图片随时接管。聊天展开时背景高斯模糊；点击右上角 X，整个聊天列（含输入区）折叠进屏幕左下角，背景随之完全清晰；再点击画面任意处（或左下角提示）又从左下角弹出展开。折叠状态下右下角显示仅圆环（无数字）的小倒计时，提示当前背景图剩余展示时间；右下角地球按钮可打开图源原图。
- 🟢 **实时同步**：Supabase Realtime（postgres_changes INSERT/UPDATE/DELETE + presence），新消息、编辑、表情反应、消失事件与在线列表实时同步；断线重连与标签页切回自动 catch-up。

## 快速开始

```bash
npm install
cp .env.local.example .env.local   # 填入你的 Supabase 项目地址与 key
npm run dev
```

### Supabase 配置（一次性）

1. 新建一个 Supabase project。
2. 在 SQL Editor 里完整执行 `supabase/schema.sql`：
   - 建 `chat_messages` 表（含 `expires_at`，默认 `now() + 1 hour`）与 RLS 策略；
   - 建 `chat_reactions` 表（消息表情反应）与 `profiles` 表（跨设备保存昵称与头像）；
   - 建公开读、按用户目录写的 `chat-images` Storage bucket；
   - 注册 Realtime publication（含 `replica identity full`，保证 UPDATE/DELETE 载荷完整）；
   - 安装 `pg_cron` 每分钟清理过期消息（计划任务不可用时自动跳过，客户端仍会自行过期）；
   - 部署并调度 `supabase/functions/purge-chat-images` Edge Function（每 5 分钟），清理孤儿照片（跳过 `avatar-*` 持久头像资源）。
3. Dashboard → Authentication → Providers：启用 **Anonymous sign-ins**（游客自动获得稳定身份）。注册/登录使用邮箱密码（如开启邮箱验证，绑定后需查收邮件）。
4. （可选，用于 cron 调用 Edge Function）在 SQL Editor 中创建 Vault secrets：`project_url` 与 `purge_service_key`（service role key），schema.sql 已包含对应调度 SQL，缺 secret 时跳过。
5. 把 Project Settings → API 里的 URL 与 publishable(anon) key 填进 `.env.local`（`VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`，旧的 `VITE_SUPABASE_ANON_KEY` 仍兼容）。

> 未配置 env 时应用照常运行（单机模式），消息只存本地、一小时后同样消失。随机背景图的 Unsplash Access Key 为可选：未配置时使用 picsum 的 Unsplash 图源。

## 目录结构

```
src/
  lib/            # 数据层（不依赖 React）
    chatSync.ts           # 同步 facade：乐观写入 + outbox 重试 + realtime 合并 + 一小时清扫
    chatRemote.ts         # Supabase 远端：分页 / realtime 频道 / presence / 图片上传 / 反应 / 编辑
    chatCache.ts          # IndexedDB 消息缓存
    chatOutbox.ts         # IndexedDB outbox（含图片 Blob）
    chatReactions.ts      # 表情反应本地聚合
    chatReactionRemote.ts # 表情反应远端持久化
    account.ts            # 匿名自动登录 / 邮箱绑定 / 登录
    profileCloud.ts       # 个人资料云端同步
    userProfile.ts        # 个人资料本地状态
    avatar.ts avatarStyles.ts avatarUpload.ts
    backgroundFeed.ts     # 随机背景图源（Unsplash / picsum）
    countdownAnimations.ts # 可切换的倒计时动画方案
    expiry.ts             # 一小时规则：到期计算
    identity.ts nickname.ts
    i18n.ts translations.ts
    tick.ts               # 全局共享的每秒 ticker
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
  styles/         # 样式分段
supabase/
  schema.sql
  functions/purge-chat-images/index.ts
```

---

<a id="english"></a>

> Language: [中文](#中文) · **English**

# one-hour · 一小时

An ephemeral public chat room: **every message (text or photo) lives for exactly one hour, both locally and in the cloud.** When its hour runs out the message dissolves gracefully, and every player online watches it leave together.

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

[中文](#中文) · **English**
