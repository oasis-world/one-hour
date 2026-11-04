# MUD 自动邀请 + 卡片游戏 — 实现计划

## Context 背景与目标
- 现状：welcome 弹窗确认后 `App.tsx` 2.5s 展开聊天，`companion` 助手立即私聊打招呼（无 3s 延迟），在线人数来自 `chatRemote.ts` 的 Realtime presence，游戏卡片通过 `__GAME__:id:instanceId` 标记在公共消息中渲染（`games/registry.ts` → `GameMessage.tsx`）。
- 需求：打招呼后 **3s**，助手自动扫描在线列表选 **2-5 人**（同语言优先）、**@ 欢迎语** + **MUD 卡片** 到公共聊天室；卡片场景需按被选人 `role` 定制，要评估前端模板 vs Baseten AI 实时生成并落地。

## 关键发现（已验证）
- `PresenceMember` 无 `lang` 字段（`chatTypes.ts` / `chatRemote.ts` `PresencePayload`），仅有 `role/displayName/avatar`；`lang` 只在本地 `one-hour-lang`。
- `WelcomeModal.tsx` → `App.tsx:280-328` 助手 greeting 无 typing、无延迟；`handleCompanionGame` 已演示“助手发卡+预建联机状态”模式（`companionGame.ts`）。
- `MessageRow.tsx` + `games/types.ts` 的 `parseGameRef`/`isGameMessage` 是扩展新游戏的唯一入口；`cloudState.ts` 每游戏一表（`gomoku_states` 等）。
- Edge Function `supabase/functions/companion-chat/index.ts` 直连 `baseten.co/v1/chat/completions`（`muse-spark-open-1026`，`json_object`，`VALID_GAMES` 白名单），含 Tavily 搜索分支；可复用/新增 `mud-generate`。
- 研究结论：聊天 MUD 宜用 **回合制+选择式卡片**（room 图 + 选项按钮 + 状态补丁），AI Dungeon 经验表明需“隐藏 worldState JSON 为真、叙事为皮”+ 预生成房图防幻觉；纯前端零延迟但重复度高，纯 AI 延迟/成本/失控高，**混合最优**。

## 推荐方案：混合（Hybrid）— 前端拥有引擎，后端负责润色
- 前端 `MudEngine` 拥有：世界图（5-7 房间 DAG）、角色→主题映射、关卡状态、回合与投票、持久化与广播；Baseten 仅把模板场景改写成贴合选中玩家角色的叙事+选项（JSON schema 约束），失败/离线则回退到本地模板，保证随时可玩。
- 比纯前端更个性化，比纯 AI 更可靠、成本低（每局首屏 1 次调用，后续回合可选），且符合现有 `companion-chat` 基础设施。

## 实现步骤

### 阶段 1 — 在线语言与选人
1. **补语言到 presence（向后兼容）**：`lib/chatRemote.ts` `PresencePayload`/`track()` 增加可选 `lang`（来自 `getLang()`）；`chatTypes.ts` `PresenceMember.lang?`；老客户端缺字段不影响。同步在 `components/useChatRoom.ts` 的 `updateIdentity` 依赖中加入 `lang`。
2. **无语言时回退**：新增 `lib/mudSelect.ts`（<150 行）：`detectScriptLang(nickname|role)` 用 Unicode 区间（zh/zh-TW/ja/ko/ar/en 等）聚类；与 `lang` 字段合并，选最大语言簇（`groupByLang`），过滤 `self + companion`，簇内按 `enteredAt` 排序，取 2-5 人；不足 2 人则不触发。暴露 `selectMudParty(presence, selfId, companionId): PresenceMember[]|null` + `sameLanguageLabel`。
3. **去重与限频**：`localStorage` key `one-hour-mud-invited:<companion.id>` + session 内存 guard，同 1h 生命周期内仅触发一次；`profileExpiresAt` 重置时清 key（复用 `expireAnonymousProfile` 钩子）。

### 阶段 2 — 触发编排（App.tsx）
- 在现有 greeting effect（`App.tsx:312-328`，`greetedRef` 双重去重）后新增 `mudAutoRef` effect：依赖 `[profile, companion, room.presence, room.identity, room.status==='open', fold==='open']`，`setTimeout(3000)` 后调用 `selectMudParty`。选中则：
  a) `buildInviteMentions(party)` 生成 `@name` 串（复用 `mention.ts` 的渲染高亮，后续扩展 `parseMentions` 支持 N 人 @），调用 `room.send(inviteText, ...)` 发欢迎语；
  b) `await createMudGame(party, identity, companion)` 生成 `instanceId` 并 `room.send(卡片消息)`。
- 欢迎语与卡片模板由 `lib/mudTemplates.ts` 提供多语言（复用 `i18n.ts` `t`），如 `zh: @A @B 冒险者们，@Companion 为你们开启了《XX遗迹》MUD…`。

### 阶段 3 — 前端模板与主题（离线可用）
- `lib/mudTemplates.ts`（<200 行）：`ROLE_THEMES: role关键词→主题`（如 工程师/科学家→废弃实验室，学生/老师→学院秘馆，骑士/武士→古城等，回退到 `city/forest/ruin/tavern/ocean/lab`）；`WORLD_SKELETONS[theme]` 预置 5-7 房间（`{id,name,descPrompt,exits,enemies}`）；`SCENE_TEMPLATES`（开场、探索、战斗、解谜、结局）+ `CHOICE_DECKS` 按角色分发。`buildMudBlueprint(party)` 输出 `MudBlueprint {title, theme, partyRoles, rooms, openingSeed}`。
- `lib/mudGeneration.ts`（<150 行）：`requestMudNarrative(blueprint, party)` 封装对新 Edge Function 的调用，`response_format: json_object` + JSON Schema（`{sceneText: string(80-180字), choices: 2-4*{label,action}, statePatch?:{hp|insight}}`），超时 8s，失败返回 `null` 让调用方用模板直出。

### 阶段 4 — MUD 游戏注册与云状态
- `games/types.ts` 扩展 `GAME_MARKER` 解析支持 `mud`（无需改）；`games/registry.ts` 新增 `defineMud`（`id:'mud'`, `minPlayers:2, maxPlayers:6`，含 host + 邀请者）。
- 新 `games/mud/types.ts`、`cloudState.ts`（仿 `gomoku/cloudState.ts`）：表 `mud_states`（`instance_id PK, state jsonb, updated_at, expires_at`），`schema.sql` 追加建表+RLS；`load/save/deleteMudState` 含 `__GAME__:mud:` 存活校验。
- `games/mud/realtime.ts` 复用 `games/realtime.ts` 的 per-instance broadcast（`mud:<id>`）；`games/mud/MudCard.tsx`（<200 行）渲染：标题+参与者头像行、场景图（可选 Unsplash 占位）、叙事卡、选择按钮（投票 45s 倒计时条，多数决/主持人决）、HP/进度、`leave/rematch`；`GameCardMenu.tsx` 可选加 `MUD` 风格切换。

### 阶段 5 — Edge Function
- 新增 `supabase/functions/mud-generate/index.ts`（复刻 `companion-chat` 鉴权+Baseten 调用）：输入 `{blueprint, party: {displayName,role}[], lang}`，systemPrompt = “你是 MUD GM，按 blueprint 的 theme/rooms 约束，只输出 JSON… 1-3 句场景+2-4 选项，融入玩家角色”，`max_tokens ~600`，温度 0.75；返回给前端合并到 `MudState.initialScene`。保留模板回退，前端不阻塞。
- 或阶段先复用 `companion-chat` 加 `mud` game 分支，视部署便利二选一（推荐独立函数，限流与 prompt 互不污染）。

### 阶段 6 — 样式与可访问性
- 新增 `src/games/mud/MudCard.css`（<150 行），遵循移动端强制规则：`@media (hover:none)` 去 hover 粘滞、`touch-action: pan-y`，按钮 44px 触靶，深色/暖色主题变量。

## 涉及文件
- 改动：`src/lib/chatTypes.ts`, `src/lib/chatRemote.ts`, `src/components/useChatRoom.ts`, `src/lib/mention.ts`, `src/App.tsx`, `src/games/types.ts`, `src/games/registry.ts`, `src/games/GameMessage.tsx`, `supabase/schema.sql`
- 新增：`src/lib/mudSelect.ts`, `src/lib/mudTemplates.ts`, `src/lib/mudGeneration.ts`, `src/games/mud/MudCard.tsx`, `src/games/mud/MudCard.css`, `src/games/mud/cloudState.ts`, `src/games/mud/types.ts`, `supabase/functions/mud-generate/index.ts`

## 拆分与约束
- 每个新文件 ≤200 行，抽子组件/工具函数；`App.tsx` 逻辑抽到 `src/lib/useMudAutoInvite.ts` hook 保持可读。

## 验证
- `npm run build` + `npm run lint` 通过（项目强制）。
- 本地多标签模拟：开 3-5 个匿名标签（不同 role/语言），过 welcome，观察：greeting 后 3s 出现 @欢迎语与 MUD 卡片；语言分组正确；卡片可投票推进；断网时仍出现模板场景。
- Baseten 验证：`supabase functions deploy mud-generate` 后，有/无 `BASETEN_API_KEY` 两种路径均可进游戏；检查回退文案与超时。
- 回归：在线列表、@高亮、现有三棋不受影响；`one-hour-mud-invited` 去重生效（刷新不重发）。
