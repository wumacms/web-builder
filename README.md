# AI 建站平台

通过对话描述需求，由 AI（DeepSeek）生成 Tailwind CSS 静态站，支持预览、下载与发布到 GitHub Pages。

## 功能

- **AI 生成**：首页输入描述，生成完整静态站点（HTML + Tailwind）
- **预览与发布**：在线预览、下载 zip、一键发布到 GitHub Pages
- **区块编辑**：按标题、段落、图片块编辑内容，保存后即时刷新预览
- **项目与多轮对话**：项目列表管理，可多轮对话优化同一站点

## 本地运行

### 环境要求

- Node.js 18+
- pnpm（推荐）或 npm / yarn

### 步骤

1. **克隆并安装依赖**

   ```bash
   pnpm install
   ```

2. **配置环境变量**

   ```bash
   cp .env.example .env
   ```

   编辑 `.env`，必填项：

   | 变量 | 说明 |
   |------|------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名 Key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端 Key |
   | `SUPABASE_STORAGE_BUCKET_SITES` | Storage 桶名（如 `sites`） |
   | `DEEPSEEK_API_KEY` | DeepSeek API Key |
   | `DEEPSEEK_BASE_URL` | DeepSeek 接口地址（如 `https://api.deepseek.com`） |

   发布到 GitHub Pages 时还需填写 `GITHUB_TOKEN`。

3. **初始化 Supabase**

   在 Supabase 中创建表与 Storage Bucket，详见 [docs/supabase-setup.md](docs/supabase-setup.md)。

4. **启动开发服务**

   ```bash
   pnpm dev
   ```

   浏览器访问 http://localhost:3000 。

### 常用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发模式 |
| `pnpm build` | 生产构建 |
| `pnpm start` | 启动生产服务 |
| `pnpm lint` | 运行 ESLint |

## 技术栈

- **前端**：Next.js 14 (App Router)、React、TypeScript、Tailwind CSS
- **后端 / 数据**：Supabase（Database + Storage）
- **AI**：DeepSeek API（OpenAI 兼容）
- **发布**：Octokit（GitHub）、archiver（zip 打包）

## 文档

- [产品需求 (PRD)](docs/PRD.md)
- [技术实现方案](docs/TECHNICAL_IMPLEMENTATION.md)
- [实现总结](docs/IMPLEMENTATION_SUMMARY.md)
- [Supabase 初始化](docs/supabase-setup.md)
- [预览页直接编辑方案评估](docs/PREVIEW_INLINE_EDIT_EVALUATION.md)
