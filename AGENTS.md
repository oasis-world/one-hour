# one-hour · Agent 工作规则

本文件对所有在此仓库工作的 agent 生效；与用户级全局规则（`~/.zcode/AGENTS.md`）同时遵循。

## 项目概览

一小时聊天室：每条消息（文字/图片）在本地与云端只存在 1 小时。技术栈：React 19 + Vite + TypeScript，Supabase（auth / realtime / presence / storage），IndexedDB 本地缓存与离线 outbox。

## 常用命令

- `npm run dev` — 本地开发
- `npm run build` — tsc 类型检查 + vite 构建（**提交前必须通过**）
- `npm run lint` — ESLint（**提交前必须通过**）

## Git 提交纪律

- **不要主动执行 `git commit` / `git push` 等提交类命令**，只有用户明确要求提交时才执行。
- **commit message 一律用英文**（标题与正文）。
- 本仓库提交身份固定为：`user.name = One Hour`、`user.email = one.hour.world@gmail.com`（已配置在仓库本地 git config，勿改动）。

## 代码文件规模

- **尽量每个代码文件不超过 200 行**（含 `.ts` / `.tsx` / `.css`）。新写代码优先拆分模块；修改已接近或超过 200 行的文件时，顺手做低风险拆分（提取子组件、工具函数、样式分段），不引入行为变化。

## 结构速览

- `src/lib/` — 数据层（Supabase 客户端、聊天同步 facade、IndexedDB 缓存/outbox、i18n、设置），不依赖 React。
- `src/components/` — UI 组件。
- `supabase/schema.sql` — 数据库结构；改动表结构时必须同步更新此文件。
- `.env.local`（不入库）— Supabase 与可选的 Unsplash key，见 `.env.local.example`。
