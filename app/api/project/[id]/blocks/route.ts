import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin, getStorageBucket } from "@/lib/supabase/server";
import { ensureBlockIds, applyBlocksToHtml, type EditableBlock } from "@/lib/html-blocks";

function isSafePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").trim();
  if (normalized.includes("..")) return false;
  if (normalized.startsWith("/")) return false;
  return normalized.length > 0 && normalized.length < 512;
}

async function getHtml(projectId: string, path: string): Promise<string> {
  const bucket = getStorageBucket();
  const storagePath = `projects/${projectId}/site/${path}`;
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(storagePath);
  if (error || !data) throw new Error("File not found");
  return data.text();
}

async function putHtml(projectId: string, path: string, html: string): Promise<void> {
  const bucket = getStorageBucket();
  const storagePath = `projects/${projectId}/site/${path}`;
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(storagePath, Buffer.from(html, "utf-8"), {
      contentType: "text/html",
      upsert: true,
    });
  if (error) throw new Error(error.message);
}

const PutBody = z.object({
  path: z.string().min(1).max(512),
  blocks: z.array(
    z.object({
      id: z.string(),
      content: z.string().optional(),
      alt: z.string().optional(),
    })
  ),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const path = req.nextUrl.searchParams.get("path") ?? "index.html";
    if (!isSafePath(path)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
    const html = await getHtml(id, path);
    const { html: htmlWithIds, blocks } = ensureBlockIds(html);
    await putHtml(id, path, htmlWithIds);
    return NextResponse.json({ path, blocks } as { path: string; blocks: EditableBlock[] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = msg === "File not found" ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = PutBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
    }
    const { path, blocks } = parsed.data;
    if (!isSafePath(path)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
    const html = await getHtml(id, path);
    const newHtml = applyBlocksToHtml(html, blocks);
    await putHtml(id, path, newHtml);
    return NextResponse.json({ ok: true, html: newHtml });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = msg === "File not found" ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
