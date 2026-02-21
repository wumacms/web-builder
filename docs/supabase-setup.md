# Supabase 初始化说明

在 Supabase Dashboard 完成以下配置后，本地复制 `.env.example` 为 `.env` 并填入实际值。

## 1. Database 表

在 SQL Editor 中执行：

```sql
-- 项目表
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  github_repo_url text,
  github_pages_url text,
  user_id uuid references auth.users(id),
  status text default 'draft' check (status in ('draft', 'generating', 'ready', 'publishing', 'published', 'error')),
  last_error text
);

-- 对话消息表
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

create index if not exists idx_messages_project_id on public.messages(project_id);
create index if not exists idx_projects_created_at on public.projects(created_at desc);
```

## 2. Storage Bucket

1. 进入 Storage，新建 bucket，名称填 `sites`（与 `SUPABASE_STORAGE_BUCKET_SITES` 一致）。
2. 可选：设为 Private，仅通过 Service Role 在服务端访问（推荐）。
3. 无需额外 Policy 即可由服务端使用 Service Role Key 读写。
