"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

type Project = {
  id: string;
  title: string | null;
  status: string;
  github_pages_url: string | null;
  github_repo_url: string | null;
  created_at: string;
};

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishLoading, setPublishLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/project/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Not found"))))
      .then(setProject)
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePublish = async () => {
    setPublishLoading(true);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      });
      const data = await res.json();
      if (res.ok && data.pagesUrl) {
        setProject((p) => (p ? { ...p, github_pages_url: data.pagesUrl, status: "published" } : null));
      } else {
        alert(data.error ?? "发布失败");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "发布失败");
    } finally {
      setPublishLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("确定要删除该网站吗？删除后无法恢复。")) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/project/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push("/projects");
      } else {
        alert(data.error ?? "删除失败");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">加载中…</p>
      </main>
    );
  }
  if (!project) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">项目不存在</p>
        <Link href="/" className="text-blue-600 hover:underline">返回首页</Link>
      </main>
    );
  }

  const previewSrc = `/api/project/${id}/site/index.html`;
  const isReady = project.status === "ready" || project.status === "published";

  return (
    <main className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <header className="flex-shrink-0 border-b border-gray-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm">首页</Link>
          <h1 className="font-semibold text-gray-800 truncate max-w-[200px]">{project.title || "未命名"}</h1>
          <span className="text-xs text-gray-400">{project.status}</span>
        </div>
        <div className="flex items-center gap-2">
          {isReady && (
            <>
              <a
                href={`/api/download/${id}`}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                下载
              </a>
              <Link
                href={`/project/${id}/edit`}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                编辑
              </Link>
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishLoading || project.status === "published"}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {project.status === "published" ? "已发布" : publishLoading ? "发布中…" : "发布到 GitHub"}
              </button>
              {project.github_pages_url && (
                <a
                  href={project.github_pages_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
                >
                  访问网站
                </a>
              )}
            </>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteLoading}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {deleteLoading ? "删除中…" : "删除网站"}
          </button>
        </div>
      </header>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {!isReady ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-gray-500">
            <p>站点尚未生成或生成失败。</p>
            <Link href="/" className="text-blue-600 hover:underline mt-2 inline-block">返回首页继续对话</Link>
          </div>
        ) : (
          <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
            <iframe
              title="预览"
              src={previewSrc}
              className="w-full flex-1 min-h-0 border-0 block"
              sandbox="allow-scripts"
            />
          </div>
        )}
      </div>
    </main>
  );
}
