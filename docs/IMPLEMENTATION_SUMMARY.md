# AI 建站平台 — 实现总结

**版本**：v1.0  
**日期**：2025-02-20  
**对应计划**：AI 建站平台开发计划（五阶段）

---

## 一、实现概览

本项目按 [PRD](PRD.md) 与 [技术实现方案](TECHNICAL_IMPLEMENTATION.md) 从零完成开发，实现「对话生成 Tailwind 静态站 → 预览 → 下载 → 发布 GitHub Pages → 在线编辑」全流程，后端统一使用 Supabase（Database + Storage），AI 使用 DeepSeek，生成站点为完整 Tailwind CSS 源码。

---

## 二、技术栈与依赖

| 类别 | 选型 |
|------|------|
| 框架 | Next.js 14（App Router）、TypeScript、Tailwind CSS |
| 后端/存储 | Supabase（PostgreSQL + Storage），服务端仅用 Service Role |
| AI | DeepSeek API（OpenAI 兼容，`openai` 包 + baseURL） |
| 发布 | Octokit（`@octokit/rest`）创建仓库并推送 |
| 校验 | zod |
| 编辑 | 可视化区块编辑（node-html-parser 解析 HTML 为区块，表单写回） |
| 打包 | archiver（zip 流式下载） |

---

## 三、目录与文件清单

```
web-builder/
├── app/
│   ├── layout.tsx                 # 根布局
│   ├── page.tsx                    # 首页（聊天建站）
│   ├── globals.css                 # 全局 Tailwind
│   ├── api/
│   │   ├── chat/route.ts           # POST 对话 + 生成
│   │   ├── project/[id]/route.ts  # GET 项目元数据
│   │   ├── project/[id]/list/route.ts
│   │   ├── project/[id]/file/route.ts
│   │   ├── project/[id]/content/route.ts  # PUT 保存整文件（保留）
│   │   ├── project/[id]/blocks/route.ts   # GET 区块列表 / PUT 保存区块
│   │   ├── project/[id]/site/[[...path]]/route.ts  # 静态资源代理
│   │   ├── projects/route.ts       # GET 项目列表
│   │   ├── publish/route.ts        # POST 发布 GitHub
│   │   └── download/[id]/route.ts  # GET 下载 zip
│   ├── project/[id]/page.tsx      # 项目详情（预览 + 操作栏）
│   ├── project/[id]/edit/page.tsx # 编辑页（可视化区块表单 + 预览）
│   └── projects/page.tsx          # 项目列表
├── components/
│   ├── chat/
│   │   ├── ChatInput.tsx
│   │   ├── MessageList.tsx
│   │   └── MessageBubble.tsx
│   └── preview/
│       └── ResultCard.tsx
├── lib/
│   ├── html-blocks.ts            # HTML 解析为可编辑区块、写回
│   ├── supabase/
│   │   ├── server.ts              # Admin 客户端（延迟初始化）
│   │   └── content-type.ts        # 扩展名 → Content-Type
│   ├── ai/
│   │   ├── deepseek.ts            # 调用 DeepSeek，系统 prompt 约束 Tailwind+JSON
│   │   └── parse.ts               # 解析 AI JSON，path 安全校验
│   ├── site-builder/upload.ts     # 解析结果上传至 Storage
│   ├── github/publish.ts          # Octokit 创建仓库、推送、返回 Pages URL
│   └── zip/stream.ts              # 从 Storage 递归打包 zip
├── docs/
│   ├── PRD.md
│   ├── TECHNICAL_IMPLEMENTATION.md
│   ├── supabase-setup.md          # 建表 SQL + bucket 说明
│   └── IMPLEMENTATION_SUMMARY.md  # 本文档
├── .env.example
├── next.config.mjs
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## 四、分阶段实现内容

### 阶段一：基础与「对话 → 生成 → 存 Supabase」

- **项目初始化**：Next.js 14（App Router）、TypeScript、Tailwind、ESLint；`.env.example` 含 Supabase、DeepSeek、GitHub 变量。
- **Supabase**：`docs/supabase-setup.md` 提供 `projects`、`messages` 建表 SQL 与 Storage bucket `sites` 说明。
- **lib/supabase/server.ts**：使用 Proxy 延迟初始化 Admin 客户端，避免 build 时因缺 env 报错。
- **lib/ai/deepseek.ts**：系统 prompt 要求「仅 Tailwind CSS、输出单一 JSON」；用户 prompt 拼接对话 + 生成说明。
- **lib/ai/parse.ts**：解析 `pages` / `assets`，strip markdown 代码块，校验 path 无 `..`。
- **lib/site-builder/upload.ts**：按 path 上传至 Storage `projects/[projectId]/site/[path]`，设置 Content-Type。
- **POST /api/chat**：校验 message、可选 projectId；若 projectId 且项目已 ready 则拒绝（不支持 AI 再修改）；新会话创建 project + 首条 message，否则追加 message；调 DeepSeek → 解析 JSON → 上传 Storage；更新项目 status；返回 `projectId`、`status: 'completed'`、`previewPath`。
- **首页**：`ChatInput`（Enter 发送、Shift+Enter 换行）、`MessageList`、`MessageBubble`；发送后 loading，完成后展示 `ResultCard`（预览 / 下载 / 编辑）。

### 阶段二：预览、下载与结果区

- **GET /api/project/[id]/site/[[...path]]**：从 Storage 读取 `projects/[id]/site/[path]`，默认 `index.html`；按扩展名设置 Content-Type，返回文件内容。
- **GET /api/project/[id]**：查询 `projects` 表返回元数据（id、title、status、github_pages_url 等）。
- **GET /api/project/[id]/list**：递归列出 `projects/[id]/site/` 下所有 key，返回相对 path 数组。
- **lib/zip/stream.ts**：递归 list 后逐文件下载，用 archiver 打包；通过 PassThrough + Readable.toWeb 转为 Web 流。
- **GET /api/download/[id]**：校验 UUID 与项目存在，流式返回 zip，`Content-Disposition: attachment`。
- **app/project/[id]/page.tsx**：项目详情页；iframe 预览 `/api/project/[id]/site/index.html`；操作栏：下载、编辑、发布到 GitHub、已发布时展示访问链接。

### 阶段三：发布到 GitHub Pages

- **lib/github/publish.ts**：Octokit 认证；创建仓库 `wb-{projectId 前 8 位}`；从 Storage 拉取 site 下全部文件，创建 blob/tree/commit，push 到 main；返回 `repoUrl`、`pagesUrl`（`https://owner.github.io/repo`）。
- **POST /api/publish**：Body `projectId`、可选 `githubToken`（否则用 `GITHUB_TOKEN`）；校验项目 status 为 ready；更新 publishing → 调用 publish → 成功写回 `github_repo_url`、`github_pages_url`、status: published；失败写 status: error、last_error。
- **项目详情页**：「发布到 GitHub」按钮；发布中/成功/失败状态；成功后展示可点击的 Pages 链接。

### 阶段四：可视化编辑与保存

- **GET /api/project/[id]/blocks?path=**：从 Storage 读取 HTML，解析可编辑区块（h1–h6、p、img），注入 data-block-id 并写回，返回 `{ path, blocks }`。
- **PUT /api/project/[id]/blocks**：Body `path`、`blocks: [{ id, content?, alt? }]`；按 id 更新 HTML 中对应区块内容后写回 Storage。
- **app/project/[id]/edit/page.tsx**：顶部返回项目、保存；左侧按 HTML 文件切换，展示区块表单（标题/段落/图片）；右侧 iframe 预览，保存后刷新。不提供源码编辑。
- **GET /api/project/[id]/file**、**PUT /api/project/[id]/content**：保留，供其它用途；编辑页仅使用 blocks API。

### 阶段五：项目列表与体验

- **GET /api/projects**：查询 `projects` 表，按 created_at 倒序，支持 limit/offset，返回 `{ projects }`。
- **app/projects/page.tsx**：项目列表页，卡片展示标题、时间、状态、预览/编辑/访问链接；首页增加「项目列表」入口。
- **单次生成、禁止 AI 再改**：网站生成后（status=ready），带该 projectId 的聊天请求会被拒绝，提示使用「编辑内容」；首页生成完成后清空 projectId，后续输入视为新建站点。
- **错误与状态**：API 统一返回 `{ error }`；首页与项目页展示错误与 loading 状态。

---

## 五、数据与存储约定

- **Supabase Database**：`projects`（id、title、status、github_repo_url、github_pages_url、created_at、updated_at、user_id、last_error）、`messages`（id、project_id、role、content、created_at）。
- **Supabase Storage**：bucket `sites`，路径 `projects/[projectId]/site/[path]`，存生成与编辑后的静态文件（HTML/JS 等，Tailwind 通过 CDN 引入）。

---

## 六、环境变量与运行

- 见 `.env.example`：Supabase URL/Anon Key/Service Role Key、Storage bucket 名、DeepSeek API Key/Base URL、可选 GITHUB_TOKEN。
- 首次运行前在 Supabase 执行 `docs/supabase-setup.md` 中的 SQL 并创建 bucket。
- `pnpm install` → `pnpm dev`，访问 http://localhost:3000。

---

## 七、构建与部署

- `pnpm run build` 已通过（Supabase 客户端延迟初始化，build 时不依赖 .env）。
- 部署时配置 Vercel 等环境变量即可；DB 与文件均在 Supabase，无需本地磁盘。

---

**文档结束。**
