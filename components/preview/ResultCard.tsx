"use client";

type ResultCardProps = {
  projectId: string;
  title?: string;
  githubPagesUrl?: string | null;
};

export function ResultCard({ projectId, title, githubPagesUrl }: ResultCardProps) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const previewUrl = `${base}/project/${projectId}`;
  const downloadUrl = `${base}/api/download/${projectId}`;
  const editUrl = `${base}/project/${projectId}/edit`;

  return (
    <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-gray-800 mb-3">你的网站已就绪</h3>
      {title && <p className="text-sm text-gray-500 mb-3">{title}</p>}
      <div className="flex flex-wrap gap-2">
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          预览
        </a>
        <a
          href={downloadUrl}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          下载压缩包
        </a>
        <a
          href={editUrl}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          编辑内容
        </a>
        {githubPagesUrl && (
          <a
            href={githubPagesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            访问已发布网站
          </a>
        )}
      </div>
    </div>
  );
}
