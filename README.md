# 一小时 · one-hour

一个"阅后即焚"的公共聊天室：**每条消息（文字或图片）在本地与云端都只存在 1 小时**，倒计时归零后优雅消散，所有在线玩家同时目送它离开。

架构与同步逻辑复刻自 oasis-game 的公共聊天室（Supabase realtime + presence + 本地优先），在此之上加入了一小时生命周期的完整设计。

## 功能

- 🕐 **一小时生命周期**：每条消息旁有环形倒计时（mm:ss）；最后 10 分钟变琥珀色、最后 2 分钟红色脉动；归零时消息模糊上浮、折叠消失（`msg-dissolve` 动画），本地 IndexedDB 与云端同时删除，其它玩家通过 realtime DELETE 同步看到。
- 🖼️ **图片消息**：桌面端 `+` 菜单上传图片；移动端 `+` 自动替换为相机按钮，直接调起手机摄像头拍照发送。图片先压缩（长边 1440 / JPEG 0.82）再上传 Supabase Storage，断网时连 Blob 一起进 outbox 稍后重试。点击图片全屏放大。
- 🌄 **动态背景**：全屏背景优先显示聊天里**最新一张图片**；聊天里没有图片时自动从 Unsplash 随机取一张（需配置 `VITE_UNSPLASH_ACCESS_KEY`，未配置时用 picsum 的 Unsplash 图源）。无论哪种来源，每张背景图**最多展示 10 分钟**，到时自动淡出换新（新的聊天图片依然随时接管）。聊天展开时高斯模糊；点击右上角 X，整个聊天列（含输入区）折叠进**屏幕左下角**，背景随之完全清晰；再点击画面任意处（或左下角提示）又从左下角弹出展开。
- 🌗 **主题切换**：顶栏在线人数旁的太阳/月亮按钮，一键切换 warm / dark 并持久化。
- 💬 **聊天列**：桌面端居中、宽 50%、高 100dvh（移动端宽 90%），四角为直角。背景半透明毛玻璃（透明度可用设置调节），顶部/底部用 mask 渐变——消息在顶端慢慢融化消失、从底端逐步浮现。
- ⌨️ **输入区**：胶囊形（圆角 999px），距底部 20px；左侧 `+`（移动端为相机）、右侧 emoji 面板与圆形发送箭头；自适应 warm / dark 双主题。
- 🎛 **左上角图标列**（竖排、统一玻璃质感小圆钮）：旅人头像（点击登录/注册，匿名身份自动登录 Supabase，绑定邮箱不换身份）→ 在线人数（绿色角标）→ warm/dark 主题切换 → 中/EN 语言切换（全部界面文案双语，语言持久化）。
- ⏲ **背景角圆环**：聊天收起、背景全屏时，右下角显示一个只有圆环（无数字）的小倒计时，提示当前背景图剩余展示时间；页面右上角的 X（小号）随时把聊天收进左下角。
- 📴 **本地优先**：消息缓存 IndexedDB（打开即渲染，滚动到顶优先读本地，本地没有才去服务器分页拉取）；发送失败（断网/慢网）进 outbox，指数退避自动重发。
- 🟢 **实时**：Supabase Realtime（postgres_changes INSERT/DELETE + presence），新消息、消失事件、在线列表实时同步。

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
   - 建公开读、按用户目录写的 `chat-images` Storage bucket；
   - 注册 Realtime publication；
   - 安装 `pg_cron` 每分钟清理过期消息（计划任务不可用时自动跳过，客户端仍会自行过期）。
3. Dashboard → Authentication → Providers：启用 **Anonymous sign-ins**（游客自动获得稳定身份）。注册/登录使用邮箱密码（如开启邮箱验证，绑定后需查收邮件）。
4. 把 Project Settings → API 里的 URL 与 publishable(anon) key 填进 `.env.local`。

> 未配置 env 时应用照常运行（单机模式），消息只存本地、一小时后同样消失。

## 运行时设置（为设置弹窗预留）

```js
window.setOneHourVeil(0.6)        // 聊天列背景透明度 0–0.92，持久化
window.setOneHourTheme('warm')    // 'warm' | 'dark' | null(跟随系统)
window.setOneHourBgTtl(600000)    // 背景图轮换时长 ms（默认 10 分钟，最小 15 秒）
```

## 目录结构

```
src/
  lib/            # 数据层（不依赖 React）
    chatSync.ts     # 同步 facade：乐观写入 + outbox 重试 + realtime 合并 + 一小时清扫
    chatRemote.ts   # Supabase 远端：分页查询 / realtime 频道 / presence / 图片上传
    chatCache.ts    # IndexedDB 消息缓存（读路径走本地）
    chatOutbox.ts   # IndexedDB outbox（含图片 Blob）
    account.ts      # 匿名自动登录 / 邮箱绑定 / 登录（oasis-game 模式）
    expiry.ts       # 一小时规则：到期计算
    identity.ts     # 旅人昵称 / 稳定用户色相
    i18n.ts         # 中英双语（持久化 + useLang 订阅）
    tick.ts         # 全局共享的每秒 ticker（所有倒计时共用一个 interval）
    settings.ts     # 透明度 / 主题 / 背景轮换时长持久化
  components/     # UI
    App.tsx         # 壳：背景 / 顶栏 / 折叠编排
    MessageList.tsx # 列表 + 渐变遮罩 + 上滑加载
    MessageRow.tsx  # 消息行（头像/时间/倒计时/图片）
    CountdownRing.tsx # 环形倒计时
    Composer.tsx    # 胶囊输入区（+ / 相机 / emoji / 发送）
    AccountDialog.tsx ImageViewer.tsx TopBar.tsx BackgroundStage.tsx
supabase/schema.sql
```
