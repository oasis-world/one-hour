# 国际象棋 AI 教学模式 — 设计方案（已确认，Token 已更新）

## 1. 背景与目标
- 现状：AI 教学入口仅 toast；game-ai-move 仅支持落子 JSON。
- 目标：点击"AI 教学"后云端大模型以新手友好方式教学（看懂局面→知道走什么→知道为什么），支持10语言，云端输出 tokens 大幅提升。

## 2. 体验设计
- 入口：GameCardMenu → AI 教学 打开 ChessTutorPanel 抽屉/弹窗（复用 WelcomeModal 的 fixed+backdrop-blur+dialog 模式，Esc/遮罩关闭）。
- 信息架构（一次请求返回结构化 JSON）：
  ① 局势总览（谁优势/王安全/材质）② 推荐走法 Top3（标签+原因，点击高亮箭头/预览试走）③ 新手小课堂（1个知识点）④ 上一步点评（好/一般/失误+更好走法）⑤ 自由提问输入框 ⑥ 鼓励语
- 棋盘联动：推荐走法 hover 高亮起止格+箭头，临时 afterBoard 预览。
- 国际化：所有文案走 t()，translations.ts 新增 10 语言。
- Token：Baseten max_completion_tokens 按用户要求 mode==='tutor'?80000:20000；OpenCode tutor 16384。

## 3. 技术方案
- Edge：复用 game-ai-move 扩展 mode=tutor，locale/question 透传，tutor prompt 输出严格 JSON（situation/keyThreats/recommendations/conceptTip/lastMoveReview/encouragement/answer），推荐走法用 sameMove 回标 legalMoves 过滤。
- 客户端：src/games/cloudAi.ts 新增 requestChessTutor + TutorResult 类型 + 5分钟位置缓存 + 5s 限流。
- UI：新增 ChessTutorPanel.tsx + CSS，ChessGame.tsx 接入 tutorOpen 状态与棋盘高亮，提问框接 useImeEnter。
- 文件变更：supabase/functions/game-ai-move/index.ts、src/games/cloudAi.ts、src/games/chess/ChessTutorPanel.(tsx|css)、src/games/chess/ChessGame.tsx、src/lib/translations.ts

## 4. 验证：npm run build + lint + 手动对局教学流程
