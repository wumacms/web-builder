import { supabaseAdmin, getStorageBucket } from "@/lib/supabase/server";
import type { ParsedSite } from "@/lib/ai/parse";

const BUCKET = getStorageBucket();

function getStoragePath(projectId: string, filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return `projects/${projectId}/site/${normalized}`;
}

export async function uploadSiteToStorage(projectId: string, site: ParsedSite): Promise<void> {
  const all = [
    ...site.pages.map((p) => ({ path: p.path, content: p.content })),
    ...site.assets.map((a) => ({ path: a.path, content: a.content })),
  ];
  for (const { path, content } of all) {
    const storagePath = getStoragePath(projectId, path);
    const body = Buffer.from(content, "utf-8");
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, body, {
      contentType: getContentType(path),
      upsert: true,
    });
    if (error) throw new Error(`Upload failed for ${path}: ${error.message}`);
  }
}

function getContentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    ico: "image/x-icon",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    woff2: "font/woff2",
    woff: "font/woff",
  };
  return map[ext ?? ""] ?? "application/octet-stream";
}
