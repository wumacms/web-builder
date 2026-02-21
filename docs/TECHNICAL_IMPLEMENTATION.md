# AI 建站平台 — 技术实现方案

**版本**：v1.0  
**更新日期**：2025-02-20  
**对应 PRD**：docs/PRD.md

---

## 一、技术栈选型

### 1.1 总体选型

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 前端 | React 18+ / Next.js 14+ (App Router) | 首屏 SSR/SSG 可选，API Routes 可作 BFF；或纯 React + Vite |
| 语言 | TypeScript | 全栈 TS，类型安全 |
| 样式 | Tailwind CSS | 快速实现 PRD 中的间距、色彩、响应式 |
| 状态 | React Query + Zustand 或 Context | 服务端状态（项目/对话）用 React Query，全局 UI 用 Zustand |
| 后端 | Node.js (Next.js API Routes) + **Supabase** | BFF 用 Next.js；数据与文件统一走 Supabase 生态 |
| AI | DeepSeek API (OpenAI 兼容) | 使用 OpenAI SDK，baseURL 指向 DeepSeek |
| 版本与发布 | Octokit (GitHub REST/API) | 创建仓库、提交文件、可选 Pages API |
| 数据与存储 | **Supabase**（Database + Storage + Auth） | 项目/对话元数据存 Supabase Postgres；生成的静态站文件存 Supabase Storage |
| 生成站点规范 | **Tailwind CSS** | AI 生成的源码为完整 Tailwind 代码（HTML 使用工具类，引入 Tailwind CDN），可独立运行 |
| 部署 | Vercel / Docker + 单机 | 前端与 BFF 同部署；Supabase 云端托管 |

### 1.2 技术栈理由简述

- **Next.js**：前后端一体、API Routes 做 BFF、易部署 Vercel；若仅需 SPA 可改为 Vite + React。
- **Supabase**：提供 Postgres 数据库、对象存储（Storage）、认证（Auth）、可选 Realtime，后端统一在一套生态内，免自建 DB 与文件服务。
- **DeepSeek**：满足“通过聊天生成静态站”的核心能力，接口与 OpenAI 兼容，接入成本低。
- **Tailwind**：生成站点统一为 Tailwind 源码，样式一致、可维护、下载后即可在任意环境运行（CDN 引入）。
- **GitHub + Octokit**：直接复用 GitHub 账号与 Pages，无需自建 CDN，用户信任度高。

---

## 二、系统架构

### 2.1 架构图（逻辑）

```
                    ┌─────────────────────────────────────────┐
                    │              用户浏览器                   │
                    │  (React/Next 前端 + 聊天 UI + 预览/编辑)   │
                    └───────────────────┬─────────────────────┘
                                        │ HTTPS
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │           BFF / Web 服务 (Next.js)       │
                    │  - 静态资源  - API 路由  - SSR(可选)      │
                    └───┬──────────────┬──────────────┬───────┘
                        │              │              │
          ┌─────────────▼──┐   ┌───────▼──────┐   ┌──▼─────────────┐
          │  DeepSeek API  │   │  Supabase     │   │  GitHub API    │
          │  (生成内容)     │   │  DB+Storage   │   │  (仓库+Pages)  │
          └────────────────┘   │  + Auth       │   └────────────────┘
                                └──────────────┘
```

### 2.2 目录结构建议

```
web-builder/
├── app/                    # Next.js App Router（或 src/app）
│   ├── layout.tsx
│   ├── page.tsx            # 首页（聊天建站）
│   ├── project/[id]/       # 项目详情、预览、编辑
│   ├── api/
│   │   ├── chat/           # 对话 + 生成
│   │   ├── project/        # 项目 CRUD、列表
│   │   ├── publish/        # 发布到 GitHub
│   │   ├── download/       # 打包 zip 下载
│   │   └── edit/           # 保存编辑内容
│   └── ...
├── components/
│   ├── chat/               # 输入框、消息列表、生成状态
│   ├── preview/            # iframe 预览、链接展示
│   ├── editor/             # 区块编辑 or 代码编辑
│   └── ui/                 # 按钮、卡片、Toast
├── lib/
│   ├── ai/                 # DeepSeek 调用、prompt 构造、解析（含 Tailwind 约束）
│   ├── supabase/           # Supabase 服务端 client、Auth 辅助；服务端仅用 service role
│   ├── github/             # Octokit、创建仓库、推送、Pages
│   ├── site-builder/       # 将 AI 输出转为文件树并上传至 Supabase Storage
│   └── zip/                # 从 Supabase Storage 拉取文件并打包为 zip 流
├── docs/
│   ├── PRD.md
│   └── TECHNICAL_IMPLEMENTATION.md
├── .env.example
├── package.json
└── README.txt
```

---

## 三、核心流程与接口设计

### 3.1 主流程：对话 → 生成 → 预览 → 发布/下载

1. **前端**：用户在首页输入描述，POST `/api/chat`，携带 `message` 与可选 `projectId`（多轮）。
2. **BFF**：  
   - 若为新会话：在 Supabase 中插入 `projects` 与首条 `messages`，得到 `projectId`。  
   - 将当前对话历史（含本轮）整理为 prompt，调用 DeepSeek；**prompt 中明确要求输出完整 Tailwind CSS 源码**（见下节）。  
   - 约定 AI 返回**结构化内容**，解析后调用 `site-builder` 将文件上传至 **Supabase Storage**（如 bucket `sites`，前缀 `projects/[projectId]/site/`）。  
   - 返回：`{ projectId, messageId, status: 'completed', previewPath }` 等。
3. **前端**：根据 `projectId` 展示预览 URL、下载、编辑入口；预览由 API 从 Storage 读取 `index.html` 等并返回，或通过带签名的 Storage 公开 URL 做 iframe。

### 3.2 AI 输出约定与解析（关键）

**目标**：让 DeepSeek 输出易于解析、可落盘为多文件的**完整 Tailwind CSS 静态站**。

**生成规范：Tailwind CSS**

- 生成的 HTML 必须**仅使用 Tailwind CSS 工具类**进行布局与样式（如 `flex`、`grid`、`text-lg`、`bg-blue-500`、`rounded-lg`、`md:flex-row` 等），不输出大段手写 CSS。
- 每个 HTML 页面需在 `<head>` 中引入 Tailwind 官方 CDN，例如：  
  `<script src="https://cdn.tailwindcss.com"></script>`  
  以便下载后的源码在本地或任意托管环境可直接打开运行。
- 若有少量必须的自定义样式（如品牌色），可使用 Tailwind 的 `style` 块或内联 `@apply`，或极简的 `<style>` 片段；主体样式必须是 Tailwind 类。

**方案 A（推荐）：JSON 描述 + 文件内容**

- 要求模型输出单一 JSON，例如：
```json
{
  "pages": [
    { "path": "index.html", "content": "<!DOCTYPE html><html>...<script src=\"https://cdn.tailwindcss.com\"></script>..." },
    { "path": "about.html", "content": "..." }
  ],
  "assets": [
    { "path": "js/main.js", "content": "..." }
  ]
}
```
- 不要求生成独立 `style.css`，样式由 Tailwind 类 + CDN 承担；若有 `assets` 可放 JS 等。
- 后端解析后按 `path` 上传至 Supabase Storage `projects/[id]/site/`，保证目录结构一致。

**方案 B**：模型直接输出多段 Markdown，用分隔符区分文件（如 `---FILE: path---`），后端按分隔符切分并上传。方案 A 更稳定，推荐。

**Prompt 设计要点**：

- 系统 prompt：角色为“静态网站生成器，仅使用 Tailwind CSS”；输出必须为上述 JSON；HTML 中必须包含 Tailwind CDN；**所有样式仅通过 Tailwind 工具类实现**，不输出大段自定义 CSS。
- 用户 prompt：拼接对话历史 + “请根据以上需求生成完整静态网站（仅使用 Tailwind CSS），输出 JSON。”
- 若输出被截断：可要求模型优先输出 `index.html` 及各页面 HTML。

### 3.3 API 设计概要

| 方法 | 路径 | 说明 | 请求体示例 |
|------|------|------|------------|
| POST | /api/chat | 发送消息并触发生成 | `{ message, projectId? }` |
| GET  | /api/project/[id] | 获取项目元数据 + 是否有 site | - |
| GET  | /api/project/[id]/list | 列出项目下文件（用于编辑） | - |
| GET  | /api/projects | 项目列表（可选分页） | - |
| POST | /api/publish | 发布到 GitHub | `{ projectId, githubToken? }` 或 OAuth 后取 token |
| GET  | /api/download/[id] | 下载项目 zip | - |
| GET  | /project/[id]/site/* | 静态资源或预览路由 | 需配置 Next 重写或 API 读文件 |
| PUT  | /api/project/[id]/content | 保存编辑（区块 or 整文件） | `{ path, content }` 或区块数组 |

**发布接口细节**：

- 入参：`projectId`，以及 GitHub Token（或从已登录 session 取）。
- 步骤：  
  1）用 Octokit 创建仓库（名称如 `wb-{projectId}` 或用户指定）；  
  2）从 **Supabase Storage** 的 `projects/[id]/site/` 递归列出并下载文件，按 GitHub API 要求构建 tree 并 commit；  
  3）push 到默认分支；  
  4）如需可调 Pages API 确保 source 为默认分支；  
  5）返回 `html_url`、`pages_url`（如 `https://owner.github.io/repo`）。
- 错误处理：仓库已存在、token 无权限、网络错误等返回 4xx/5xx 与明确文案。

### 3.4 预览与静态资源访问

- **实现**：API Route（如 GET `/api/project/[id]/site/[[...path]]`）从 **Supabase Storage** 读取 `projects/[id]/site/` 下对应文件并返回，设置正确 Content-Type。前端预览 iframe 的 src 指向该 API 或首屏 `index.html` 的代理 URL。
- **可选**：对 Storage 的 `sites` bucket 配置公开读或带签名的公开 URL，前端 iframe 直接使用签名 URL（需注意过期与刷新）。

### 3.5 下载 Zip

- 在服务端：从 **Supabase Storage** 列出 `projects/[id]/site/` 下所有对象，逐一下载到内存或临时流，使用 `archiver` 打包为 zip。
- GET `/api/download/[id]`：设置 `Content-Disposition: attachment; filename="site-{id}.zip"`，流式写入 response。解压后为用户得到的**完整 Tailwind 静态源码**。

---

## 四、数据模型与存储（Supabase）

### 4.1 Supabase Database（PostgreSQL）

**表：projects**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID, PK, default gen_random_uuid() | 项目唯一标识 |
| title | text | 站点标题（可从首轮对话或 AI 提取） |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 最后更新时间 |
| github_repo_url | text | 发布后的仓库 URL（可选） |
| github_pages_url | text | 访问域名（可选） |
| user_id | uuid | 可选，关联 auth.users，用于 RLS |
| status | text | draft / generating / ready / publishing / published / error |
| last_error | text | 最近一次错误信息（可选） |

**表：messages（对话历史）**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID, PK, default gen_random_uuid() | 消息 ID |
| project_id | uuid, FK → projects.id | 所属项目 |
| role | text | 'user' | 'assistant' |
| content | text | 内容 |
| created_at | timestamptz | 时间 |

- **RLS**：若启用多租户，可为 `projects`、`messages` 设置 Row Level Security，按 `user_id` 或 `project_id` 限制访问；服务端使用 `SUPABASE_SERVICE_ROLE_KEY` 可绕过 RLS 做管理端逻辑。

### 4.2 Supabase Storage

- **Bucket**：建议单独 bucket，如 `sites`（或与项目共用 `project-files`）。
- **路径规则**：`projects/[projectId]/site/[path]`，例如：  
  `projects/abc-123/site/index.html`、`projects/abc-123/site/about.html`、`projects/abc-123/site/js/main.js`。
- **内容**：由 AI 输出与 site-builder 写入，至少包含 `index.html`；全部为** Tailwind CSS 驱动的静态资源**，无服务端脚本。
- **策略**：上传与列表、下载由服务端用 Service Role 完成；若需前端直传/直读，可配置 Storage Policy（如按 projectId 或 user_id 限制）。

### 4.3 Supabase Auth（可选）

- 用户账号（F-11）可直接使用 **Supabase Auth**：邮箱/密码、Magic Link、或 OAuth（GitHub/Google 等）。
- 前端使用 `@supabase/supabase-js` 的 `createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)` 调用 `signInWithPassword`、`signUp` 等；服务端需校验用户时可用 `getUser(jwt)` 或通过 API 传递 session。
- `projects.user_id` 关联 `auth.users.id`，RLS 限制用户仅能访问自己的项目。

---

## 五、前端实现要点

### 5.1 首页

- 单页：顶部品牌，中间聊天输入框，下方对话列表。
- 发送消息：`POST /api/chat`，请求中可带 `projectId`（若已有）。展示 loading 状态；流式可选（若 DeepSeek 支持 stream，可逐步显示“正在生成…”）。
- 收到 `status: 'completed'` 后：请求 `GET /api/project/[id]` 取 `github_pages_url`、预览路径，展示结果卡片（链接、下载、编辑）。

### 5.2 预览

- 预览 URL：`/project/[id]/preview` 或直接 iframe ` /project/[id]/site/index.html`（由后端提供路由）。
- 若为独立预览页，页内仅一个 iframe，src 指向上述地址。

### 5.3 编辑

- **区块编辑**：GET 项目文件列表或预定义区块配置，渲染表单；PUT 时调用 `/api/project/[id]/content` 更新指定 path 或区块，成功后刷新预览。
- **源码编辑**：GET 某 path 的 raw 内容（可从 `/api/project/[id]/file?path=index.html` 等），前端用 Monaco 编辑，保存时 PUT 同一接口。
- 保存后可选“重新发布”，调用 `/api/publish` 再次推送。

### 5.4 状态与错误

- 使用 React Query 管理 project、messages、publish 状态；Zustand 存当前 projectId、侧栏开关等 UI 状态。
- 网络错误、AI 失败、发布失败：Toast 或行内提示，并给出“重试”或“联系支持”的引导。

---

## 六、安全与配置

### 6.1 环境变量

- **Supabase**：  
  - `NEXT_PUBLIC_SUPABASE_URL`：Supabase 项目 URL（前端直连时用）。  
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`：匿名 key（前端 Auth、可选直读）。  
  - `SUPABASE_SERVICE_ROLE_KEY`：服务端用，用于 Database 与 Storage 的完整读写，**勿暴露到前端**。
- **Supabase Storage**：  
  - `SUPABASE_STORAGE_BUCKET_SITES`：存静态站文件的 bucket 名，如 `sites`。
- **DeepSeek**：  
  - `DEEPSEEK_API_KEY`：DeepSeek API 密钥。  
  - `DEEPSEEK_BASE_URL`：如 `https://api.deepseek.com`（按官方文档填写）。
- **GitHub**：  
  - `GITHUB_APP_ID` / `GITHUB_PRIVATE_KEY` 或 `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`：若用 GitHub App 或 OAuth 发布。

### 6.2 安全要点

- **Supabase**：Service Role Key 仅在后端使用；RLS 与 Storage Policy 按需开启，避免未授权跨项目访问。
- **GitHub Token**：仅用于创建仓库与推送，不记录到日志；若用户自带 token，建议短期使用或 Fine-grained token 最小权限。
- **生成内容**：禁止执行服务端脚本；仅向 Supabase Storage 的 `projects/[id]/site/` 前缀写入静态文件，禁止路径穿越。
- **输入校验**：对 `message` 长度、`projectId` 格式做校验；下载与预览接口校验 `id` 归属（与 RLS/Policy 一致）。

---

## 七、部署与运维

- **构建**：`npm run build`（Next.js）。
- **运行**：`npm run start`；无需本地磁盘存储，DB 与文件均在 Supabase。
- **托管**：Vercel 可直接连 Git 部署；环境变量配置 Supabase 与 DeepSeek、GitHub 即可。
- **监控**：记录 /api/chat、/api/publish 的耗时与错误率；DeepSeek 与 GitHub 的 4xx/5xx 打点，便于排查。

---

## 八、实施阶段建议

| 阶段 | 内容 | 产出 |
|------|------|------|
| 1 | Supabase 项目创建、Database 表与 Storage bucket；脚手架 + 首页聊天 UI + /api/chat 调通 DeepSeek，**要求输出 Tailwind 源码**的 JSON 并上传至 Storage | 能对话并生成一个 Tailwind 版 index.html，存 Supabase |
| 2 | 预览路由（从 Storage 读文件）+ 下载 zip（从 Storage 打包）+ 结果区 | 完整“生成→预览→下载”闭环 |
| 3 | GitHub 发布（从 Storage 取文件、创建仓库、推送、返回 Pages URL） | 可发布到 GitHub Pages 并访问 |
| 4 | 编辑模式（区块或源码）+ 保存到 Storage + 重新发布 | 支持手动改内容并再发布，保持 Tailwind 结构 |
| 5 | 项目列表（Supabase 查询）、多轮对话、Auth 可选、错误与状态优化 | 体验与稳定性达标 |

---

**文档结束。** 实现时以 PRD 为准，本方案作为技术实施指南，可按迭代调整细节。
