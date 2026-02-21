import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin, getStorageBucket } from "@/lib/supabase/server";

const Body = z.object({
  path: z.string().min(1).max(512),
  content: z.string(),
});

function isSafePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").trim();
  if (normalized.includes("..")) return false;
  if (normalized.startsWith("/")) return false;
  return true;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { path, content } = parsed.data;
    if (!isSafePath(path)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
    const bucket = getStorageBucket();
    const storagePath = `projects/${id}/site/${path}`;
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storagePath, Buffer.from(content, "utf-8"), {
        contentType: path.endsWith(".html") ? "text/html" : path.endsWith(".css") ? "text/css" : "application/javascript",
        upsert: true,
      });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
