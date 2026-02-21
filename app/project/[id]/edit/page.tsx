"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useCallback, useMemo } from "react";

type EditableBlock = {
  id: string;
  type: "heading" | "paragraph" | "image";
  content: string;
  alt?: string;
};

function injectBaseForPreview(html: string, baseUrl: string): string {
  const escaped = baseUrl.replace(/"/g, "&quot;");
  const baseTag = `<base href="${escaped}">`;
  const headMatch = html.match(/<head\b[^>]*>/i);
  if (headMatch) {
    return html.replace(headMatch[0], headMatch[0] + baseTag);
  }
  return baseTag + html;
}

export default function EditPage() {
  const params = useParams();
  const id = params.id as string;
  const [htmlFiles, setHtmlFiles] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("index.html");
  const [blocks, setBlocks] = useState<EditableBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewPath, setPreviewPath] = useState<string | null>(null);

  const loadHtmlFiles = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/project/${id}/list`);
    if (!res.ok) return;
    const data = await res.json();
    const list = (data.files ?? []).filter((f: string) => f.endsWith(".html"));
    setHtmlFiles(list.length ? list : ["index.html"]);
    setCurrentPath((p) => (list.includes(p) ? p : list[0] ?? "index.html"));
  }, [id]);

  useEffect(() => {
    if (id) loadHtmlFiles();
  }, [id, loadHtmlFiles]);

  const loadBlocks = useCallback(async () => {
    if (!id || !currentPath) {
      setBlocks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setPreviewHtml(null);
    setPreviewPath(null);
    try {
      const res = await fetch(
        `/api/project/${id}/blocks?path=${encodeURIComponent(currentPath)}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "加载失败");
      }
      const data = await res.json();
      setBlocks(data.blocks ?? []);
    } catch (e) {
      setBlocks([]);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id, currentPath]);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  const updateBlock = useCallback((index: number, updates: Partial<EditableBlock>) => {
    setBlocks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, ...updates } : b))
    );
  }, []);

  const handleSave = async () => {
    if (!id || !currentPath) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/project/${id}/blocks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: currentPath,
          blocks: blocks.map((b) =>
            b.type === "image"
              ? { id: b.id, content: b.content, alt: b.alt }
              : { id: b.id, content: b.content }
          ),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const html = data.html as string | undefined;
        if (html) {
          const baseUrl =
            typeof window !== "undefined"
              ? `${window.location.origin}/api/project/${id}/site/`
              : "";
          setPreviewHtml(injectBaseForPreview(html, baseUrl));
          setPreviewPath(currentPath);
        }
      } else {
        alert(data.error ?? "保存失败");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const previewSrc = useMemo(
    () => `/api/project/${id}/site/${currentPath}`,
    [id, currentPath]
  );
  const useSrcdoc =
    previewHtml !== null && previewPath === currentPath;

  return (
    <main className="min-h-screen flex flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            href={`/project/${id}`}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            返回项目
          </Link>
          <span className="text-gray-400">|</span>
          <span className="text-sm font-medium text-gray-700">可视化编辑</span>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </header>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-0">
        <div className="flex flex-col border-r border-gray-200 bg-white min-h-[50vh] overflow-auto">
          <div className="flex gap-1 border-b border-gray-200 overflow-x-auto p-2">
            {htmlFiles.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setCurrentPath(f)}
                className={`rounded px-2 py-1 text-sm whitespace-nowrap ${
                  currentPath === f
                    ? "bg-blue-100 text-blue-800"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="p-4 space-y-4">
            {loading ? (
              <p className="text-gray-500 text-sm">加载中…</p>
            ) : blocks.length === 0 ? (
              <p className="text-gray-500 text-sm">
                本页暂无可编辑区块，或该文件不是 HTML 页面。
              </p>
            ) : (
              blocks.map((block, index) => (
                <div
                  key={block.id}
                  className="rounded-lg border border-gray-200 p-3 bg-gray-50"
                >
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {block.type === "heading"
                      ? "标题"
                      : block.type === "paragraph"
                        ? "段落"
                        : "图片"}
                  </span>
                  {block.type === "image" ? (
                    <div className="mt-2 space-y-2">
                      <label className="block text-xs text-gray-500">
                        图片地址 (URL)
                      </label>
                      <input
                        type="text"
                        value={block.content}
                        onChange={(e) =>
                          updateBlock(index, { content: e.target.value })
                        }
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        placeholder="https://..."
                      />
                      <label className="block text-xs text-gray-500">
                        替代文字 (alt)
                      </label>
                      <input
                        type="text"
                        value={block.alt ?? ""}
                        onChange={(e) =>
                          updateBlock(index, { alt: e.target.value })
                        }
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        placeholder="图片描述"
                      />
                    </div>
                  ) : (
                    <textarea
                      value={block.content}
                      onChange={(e) =>
                        updateBlock(index, { content: e.target.value })
                      }
                      rows={block.type === "heading" ? 1 : 3}
                      className="mt-2 w-full rounded border border-gray-300 px-2 py-1.5 text-sm resize-y"
                      placeholder={
                        block.type === "heading" ? "标题文字" : "段落内容"
                      }
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        <div className="flex flex-col bg-gray-100 min-h-[50vh]">
          <p className="text-xs text-gray-500 px-2 py-1 border-b border-gray-200">
            预览（点击保存后立即更新）
          </p>
          <div className="flex-1 min-h-0">
            {useSrcdoc ? (
              <iframe
                key="srcdoc-preview"
                title="预览"
                srcDoc={previewHtml ?? undefined}
                className="w-full h-full border-0 bg-white"
                sandbox="allow-scripts"
              />
            ) : (
              <iframe
                key={previewSrc}
                title="预览"
                src={previewSrc}
                className="w-full h-full border-0 bg-white"
                sandbox="allow-scripts"
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
