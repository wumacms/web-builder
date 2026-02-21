"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Project = {
  id: string;
  title: string | null;
  status: string;
  github_pages_url: string | null;
  created_at: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProjects = () => {
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then((data) => setProjects(data.projects ?? []))
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDelete = async (projectId: string) => {
    if (!confirm("确定要删除该网站吗？删除后无法恢复。")) return;
    setDeletingId(projectId);
    try {
      const res = await fetch(`/api/project/${projectId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      } else {
        alert(data.error ?? "删除失败");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString("zh-CN");
    } catch {
      return s;
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <Link href="/" className="text-blue-600 hover:underline text-sm">← 首页</Link>
        <h1 className="text-xl font-semibold text-gray-800 mt-2">项目列表</h1>
      </header>
      <div className="flex-1 p-4 max-w-3xl mx-auto w-full">
        {loading && <p className="text-gray-500">加载中…</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!loading && !error && projects.length === 0 && (
          <p className="text-gray-500">暂无项目，去首页创建一个吧。</p>
        )}
        <ul className="space-y-3">
          {projects.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-800 truncate">{p.title || "未命名"}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(p.created_at)} · {p.status}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link
                  href={`/project/${p.id}`}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                >
                  预览
                </Link>
                <Link
                  href={`/project/${p.id}/edit`}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  编辑
                </Link>
                {p.github_pages_url && (
                  <a
                    href={p.github_pages_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
                  >
                    访问
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  disabled={deletingId === p.id}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingId === p.id ? "删除中…" : "删除"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
