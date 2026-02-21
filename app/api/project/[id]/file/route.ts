import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getStorageBucket } from "@/lib/supabase/server";

function isSafePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").trim();
  if (normalized.includes("..")) return false;
  if (normalized.startsWith("/")) return false;
  return normalized.length > 0 && normalized.length < 512;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const path = req.nextUrl.searchParams.get("path");
  if (!path || !isSafePath(path)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  const bucket = getStorageBucket();
  const storagePath = `projects/${id}/site/${path}`;
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(storagePath);
  if (error || !data) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  const text = await data.text();
  return NextResponse.json({ content: text });
}
