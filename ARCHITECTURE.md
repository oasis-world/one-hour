# One-Hour 项目全面架构报告

> 已对仓库全部代码进行通读核对——不是仅看 `README.md`，而是逐个读过 `src/App.tsx`、`src/lib/` 数据层、`src/components/`、`src/games/`、`supabase/schema.sql` 及 `supabase/functions/` 五个云函数入口。

## 一、项目定位与技术栈

**一句话定位：** 一个「每条消息本地与云端只存在 1 小时」的短暂公共聊天室，同时也是探索 AI 社交玩法的试验场，内置桌游、AI 伴侣与永恒 MUD 世界。

**技术栈：**

- 前端：React 19 + Vite + TypeScript（`npm run build` = `tsc -b && vite build`，提交前必须通过，`npm run lint` 同理）。
- 后端：Supabase（Auth 匿名登录 / Realtime `postgres_changes` + Presence / Storage / Edge Functions / `pg_cron`）。
- 本地：IndexedDB 自研轻封装（无依赖，`src/lib/idb.ts`），DiceBear 头像，`heic2any` 转码，`@supabase/supabase-js` 懒加载（动态 `import()`，不在首屏 chunk，未配置时不加载）。

**目录结构（已含最新 `games/`）：**

```text
src/
  App.tsx              # 布局、折叠编排、welcome/summary 门禁、伴侣 @ 流程
  main.tsx / index.css
  lib/                 # 数据层（无 React）：~60 个模块
  components/          # UI：~42 个组件
  games/               # 桌游框架 + gomoku/chess/xiangqi/mud
  styles/              # 按段拆分的 CSS（每文件尽量 ≤200 行）
supabase/
  schema.sql           # 唯一真实结构源，改表必须同步
  config.toml
  functions/           # companion-chat / world-mud-narrate /
                       #   game-ai-move / purge-chat-images
```

构建细节：`vite.config.ts` 强制 `cssMinify: 'esbuild'`，避免 Lightning CSS 合并 `backdrop-filter` + `-webkit-backdrop-filter` 而在只支持标准属性的浏览器上丢掉毛玻璃。

## 二、核心架构图

```text
┌──────────────────────────────────────────────┐
│ UI 层 (components/) React                     │
│ App(useChatRoom) ── MessageList/Composer/     │
│ BackgroundStage/SettingsBar/TopBar/弹窗       │
└──────────────┬───────────────────────────────┘
               │ ChatApi (send/retry/remove/edit/…)
┌──────────────▼───────────────────────────────┐
│ chatSync.ts 同步门面：乐观写 + outbox 重试 +   │
│ 实时合并 + 每秒 sweep 过期 + 溶解动画         │
├── chatRemote.ts   （Supabase 远端/分页/Presence）
├── chatCache.ts / chatOutbox.ts / idb.ts（本地）
├── expiry.ts / tick.ts（1 小时规则 / 共享 1s 时钟）
└── account.ts / identity.ts / profileCloud.ts  （身份）
               │ Supabase
┌──────────────▼───────────────────────────────┐
│ Postgres 表 + RLS + Realtime publication      │
│ Storage chat-images 桶 + Edge Functions (AI)  │
└──────────────────────────────────────────────┘
```

### 1. 消息生命周期（1 小时铁律）

- **类型**（`chatTypes.ts`）：`ChatMessage`（含 `id/userId/displayName/avatar* /content/replyTo/at/serverCreatedAt/expiresAt/farewell/imageUrl/editedAt`）→ `ChatEntry` 额外 `state: 'pending'|'failed'`、`localImage`（对象 URL 预览）、`expiring`（溶解动画中）。`PresenceMember` 带 `enteredAt/avatar/role/profileExpiresAt/lang`。
- **过期锚点**（`expiry.ts`）：`MESSAGE_TTL_MS = 1h`，`FAREWELL_TTL_MS = 10min`；以服务器 `created_at` 为锚（所有客户端一致），未确认时用本地发送时间；`expiresAt` 可覆盖，但告别消息取 `min(expiresAt, 10min)`。
- **sweep**：`chatSync` 每 1 秒扫一次，`isExpired` 即 `beginExpire`——置 `expiring`，等 1050ms 溶解动画播完再本地删（`removeChatCacheEntry` + `removeFromOutbox` + 撤销对象 URL），作者本人同时云删（`deleteMessage`）。内存上限 400 条。
- **服务端兜底**：`pg_cron` 每分钟跑 `purge_expired_chat_messages()`（`SECURITY DEFINER`，删过期消息/告别 10 分钟/匿名画像过期连带消息/四张游戏状态表过期行/孤儿游戏卡），每个客户端每 2 分钟也会调一次该 RPC 兜底；403/404/42501 永久禁用该会话的 fallback。图片不进 SQL 删——走 Storage API（作者客户端删）+ Edge Function 定期扫孤儿图（跳过 `avatar-*` 持久素材）。

### 2. 数据层详解

| 模块 | 职责与关键机制 |
|---|---|
| `chatSync.ts` | 门面：先落乐观条目 + 入 outbox，后台刷盘；失败降级 offline 并按 `[1s,4s,15s,30s]` 退避重试；合并服务器回显（保留本地对象 URL 预览直到远端 URL 到达，保留本地头像/回复快照）；分页游标 `serverCursor`；`expireUserMessages`（画像过期删本人消息，跳过告别留言）；`loadOlder` 本地优先。 |
| `chatRemote.ts` | 远端：`chat:global` 频道；`fetchChatPage` 用 `expires_at > now()` 过滤、`(created_at,id)` 复合游标、取 41 条判 `hasMore`；Presence 60s 心跳、3 分钟幽灵过滤（注释写明时钟偏斜权衡）；图片上传 60s / 插入 30s 超时（防卡住的照片锁死队列）；发消息先上传图再插行；`replica identity full` 保证 UPDATE/DELETE 载荷完整。 |
| `chatCache.ts` | 确认消息缓存（不含 pending/failed），上限 400；`pruneChatCache` 删关应用期间已过期行与滑窗外行；`loadChatCacheBefore` 供向上翻页本地读。 |
| `chatOutbox.ts` | 持久队列（含图片 Blob），上限 30，`attempts` 上限 5，`exhaustOutboxItem` 对服务端拒绝直接烧完预算；`updateOutboxContent` 支持排队中编辑。 |
| `idb.ts` | 库 `one-hour-chat` v3：`messages`、`outbox`、`kv`、`companion_messages` 四表；全部 best-effort，IDB 不可用（隐私模式/配额）退化纯内存。 |
| `account.ts` | `guest→anonymous→signedIn` 三态订阅；启动时先读会话→试 vault 镜像的 refresh/access token 恢复→才新建匿名；邮箱绑定沿用同一 `userId`（消息不孤儿）；错误归类（invalid-credentials/email-taken/rate-limited 等）。 |
| `identity.ts` | `resolveChatIdentity`；welcome 前用共享随机草稿占位；无后端时纯本地 `local-xxx` 随机 uid（双写 localStorage+vault）；`userHue` 按 userId 哈希 8 色轮换名字/头像色。 |

### 3. UI 层与交互规约

`App.tsx` 是编排中枢：折叠四态 `open/folding/folded/unfolding`（点右上 X 折到左下角，背景全清晰；点任意处展开；折叠时右下角只剩 `BgSlotRing` 倒计时 + 地球按钮开来源图），splash 去除，`scheduleReveal` 2.5s 延迟展开（`revealActive` 防 visibility+focus 双触发播两次动画）。

- **消息**：`MessageList/Row`（倒计时环多风格：classic/soft line/segments/breathing/halo/orbit，由 `settings` 切换；末 10 分钟琥珀、末 2 分钟红色脉冲）、`MessageMenu`（回复/编辑/删/复制）、`MsgHoverBar`（桌面悬停工具）、`MsgReactions`（点赞外表情反应，`chat_reactions` 表，快照完成前缓冲增量防乱序，失败回滚）、`ImageViewer`（手势滑动/双击捏合缩放/上抛关闭）。
- **背景**：`BackgroundStage` 优先最新聊天图（全员同步，带其倒计时），优先通过已鉴权的 Supabase Edge Function 请求 Unsplash（密钥仅在服务端），再回退 Picsum 与 6 张 Unsplash CDN 图；用普通图片加载预检，避免依赖图源 CORS；最长一小时交叉淡入新图；聊天开启时模糊。
- **输入与模态**：`Composer`（`+` 菜单多选最多 5 图、触屏走拍摄/相册、HEIC 自动转 JPEG 压缩长边 1440 0.82 质量、@ 伴侣、回复/编辑态）；`WelcomeModal`（首访选脸+昵称）、`SummaryModal`（画像过期后的统计小结 `lifetimeStats`，含 `PendingSummary` 持久化防重弹 + `resetStats`）。
- **强制规则已落地**：所有 Enter 均接 `useImeEnter`（`isComposing` + `keyCode 229` + Safari 延迟一拍三信号）；弹窗点空白关闭接 `popoverGuard`（引用计数+关闭时间戳 ~450ms，`App` 内还用 `menuClosedAt` ref 同步守卫防 pointerdown→click 误触折叠）；移动端 `@media (hover:none)` 下列表 hover 背景透明 + `touch-action: pan-y`；清空按钮在输入框内右侧、点按 preventDefault 保焦；文件均≤200 行倾向、样式分段；**git 命令一律不主动执行**。

> 注意：`App.tsx` 顶部有 `EXPERIMENT` 标记——邮箱登录/绑定与 ProfilePage 被注释禁用（匿名-only 测试中），预留可回滚；`WelcomeModal` 仍在。

媒体：`MessageMediaEmbed` 支持 YouTube/Vimeo/TikTok/Spotify/SoundCloud/直链音频（各独立组件 + `useYouTubePlayer`），`mediaPlayback` 在折叠时暂停消息媒体，`useBackgroundMusic` 背景音乐按语气播（`musicTracks`）。

i18n：`i18n.ts/translations.ts`，中英日法西德韩意阿拉伯等 10 种语言，问候语/回退回复/MUD 文案全语言模板。

## 三、身份与画像体系

- 匿名画像也只活 1 小时：`profileLifetime` 存 `expiresAt`，`App` 每轮检查，到期 → `expireUserMessages(userId)` + 清伴侣画像/消息 + 存 `PendingSummary` 弹小结 + 重建匿名会话重开 welcome。
- `profiles` 表：`nickname/avatar_style/avatar_seed/avatar_url/role/expires_at`；登录用户 `expires_at=NULL` 永不删；`delete_profile_messages` 触发器随画像删除清其过期消息；客户端 `watchAccountForProfileSync` 在登录后把画像同步云端，访客纯本地。
- 头像：DiceBear 选 `style+seed`（`avatarStyles.ts`）或上传照片（`avatarUpload.ts`），发送时快照进消息行保证历史自包含，照片优先于生成脸。

## 四、游戏系统（`src/games/`）

**框架：** `registry.ts` 注册 4 款（五子棋/中国象棋/国际象棋/MUD 文字冒险，人数 1-2 或 2-6）。聊天消息内容用 `__GAME__:type:instanceId` 标记自嵌入卡，`parseGameRef` 解析，`GameMessage` 渲染对应组件（`instanceId/hostUserId/onlineMembers`）。

**同步模型：** 每局一个 Realtime 广播频道（`realtime.ts`）+ 持久快照表 `*_states(instance_id PK, state jsonb, updated_at, expires_at 默认 +1h)`；Presence 键 `userId:pageId` 选最小者为 host 权威防多 tab 双行；仅在 `joined + socket connected` 才广播；重连时先读云快照恢复。`*_states` RLS 放宽为登录用户全 CRUD，purge 按过期时间 +「卡消息已消失（content LIKE %instanceId%）」双条件清。

| 游戏 | 结构 |
|---|---|
| 五子棋/象棋/国际象棋逻辑 | `logic.ts`（纯规则）+ `ai.ts`（本地 AI）+ `cloudState/cloudHints`（云同步/提示）+ `Game.tsx`；象棋 AI 另有 `ai/worker/search/evaluate/openingBook`（异步 worker 搜索+评估+开局库），国际象棋多 `ChessTutorPanel` 辅导面板。`AiControls/AiThinkingTimer/AiSourceIcon` + `aiModePreference` + `cloudAi.ts` 统一三种 AI 模式（自己/本地 AI/云 AI，经 `game-ai-move` 云函数），`GameCardMenu` 提供卡片菜单。 |
| MUD（世界） | `registry.ts` 的 `mud` 直接渲染 `WorldMudGame`（永恒沙漏世界）。 |
| WorldMUD（永恒沙漏世界） | 单行 `world_mud_state(world_id='main')` **永不 purge**，Realtime 订阅他人动作；`worldState.ts` 本地 localStorage 365 天兜底 + 种子、玩家化身 1 小时（`joinedAt+1h` 过期剔除）、日志保留最后 80 条、`stats.totalActions/totalPlayersEver`；`worldTypes.ts` 建世界（plaza/ruin/lab/forest/ocean/city/tavern/academy 区）；叙事经 `world-mud-narrate` 云函数（见下）。 |

## 五、AI 伴侣系统

- **画像/存储/上下文**：`companionProfile`（每人一个助手名+角色）、`companionStore`（1 对 1 消息在 IDB `companion_messages`，同样 1 小时过期+prune）、`companionContext`（拼系统提示词，含用户画像）、`companionGame`（意图建局）、`mention.ts`（@ 检测）。
- **链路**：点 Composer 中头像或 @ 助手 → `companionChat.ts` 调 Edge `companion-chat` → 失败用全语言本地回退模板；问候语 natively 带 MUD 邀请文案（「永恒沙漏」）。
- **`worldMudNarrate.ts`**：客户端薄封装，失败静默回退模板（502/未部署/无 key 不刷屏）。

## 六、云函数（`supabase/functions/`）

通用模式：CORS、仅 POST、`Bearer` 经 Supabase `/auth/v1/user` 校验（5s 超时）、上游统一 `OpenCode Go muse-spark-1.3-contributor`（`https://opencode.ai/inference/go/openai/v1/responses`，Responses 格式，`instructions` + `input`，`reasoning: {effort: 'minimal'}`）。

| 函数 | 入参 | 出参/行为 |
|---|---|---|
| `companion-chat` | `systemPrompt/history/userText/companionName/userName/isGreeting` | 强制 JSON `{reply, game}`；加固提示禁泄露 reasoning；问候强制 `@userName` 开头；含新闻关键词走 Tavily 搜索注入（无 key 时提示 cutoff 透明）；上游 45s 超时、2048 tokens；空回复/纯文本时关键词推断 game 兜底。 |
| `world-mud-narrate` | `actionText/locationId/districtId/roomName/player/lang/recentLog/globalEvent` | JSON `{narrative(≤800), choices(≤4，snake_case action), broadcast(≤60), hint}`；**严格单语言规则**（英文时禁中文字符）；20s 超时；无 key/失败时 zh/ja/en 模板回退。 |
| `game-ai-move` | 走法请求 | 云 AI 落子（桌游云模式）。 |
| `purge-chat-images` | 空体 | service_role 扫 `chat-images` 桶孤儿照片（需 Vault 两密钥，见 schema）。 |

## 七、数据库结构一览（`supabase/schema.sql`）

| 表/桶 | 要点 |
|---|---|
| `chat_messages` | `expires_at` 默认 `now()+1h`；`check(内容>0 OR 图不为空)`、正文≤1000；`replica identity full`；索引 `created_at desc` + `expires_at`；RLS：登录可读、仅本人写删改。 |
| `chat_reactions` | PK `(message_id,user_id,emoji)`，级联删；登录可读、仅本人增删；进 Realtime 发布。 |
| `profiles` | 匿名 `expires_at=+1h`、登录 `NULL`；删画像触发器清其过期消息。 |
| `gomoku/xiangqi/chess_states` | `state jsonb` 快照，`expires_at +1h` 滚动续命。 |
| `world_mud_state` | 永恒单行，无过期、无 delete 策略，仅登录读写。 |
| `chat-images` 桶 | 公共读、本文件夹（uid 首段）读写。 |
| 函数/定时 | `purge_expired_chat_messages()`（见上）+ `pg_cron: * * * * *`；`purge-chat-images` 每 5 分钟经 vault 密钥调 Edge（无 pg_net/密钥时静默跳过）。 |

## 八、已为后续任务做的准备 / 注意点

1. **改聊天** → 入口 `useChatRoom → chatSync → chatRemote`；改同步策略别绕开 outbox；改过期规则三处同改：`expiry.ts` 前端、`schema.sql` 默认值+purge 语句、purge 的 `farewell 10min` 分支。
2. **改表** → 必须同步 `schema.sql`；注意现有库靠 `if not exists` 补列，结构变更要留迁移块；Realtime 需 `replica identity full`。
3. **新开游戏** → 照 `registry + types(GameDefinition) + cloudState/cloudHints + realtime.ts` 模板，别忘了在 schema 加 `*_states` 表、purge 清理、`instance_id` 关联卡消息的删除条件。
4. **AI 链路** → 模型名硬编码在四个云函数顶部常量；key 只在 Edge 环境变量，绝不进前端；前端一律「失败本地回退」。
5. **性能/兼容** → 新输入框必接 `useImeEnter`；新浮层必接 `popoverGuard`（450ms 时间戳）；移动端 hover 禁粘滞；文件保持 ≤200 行拆分。
