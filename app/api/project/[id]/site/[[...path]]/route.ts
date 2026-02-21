import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getStorageBucket } from "@/lib/supabase/server";
import { getContentType } from "@/lib/supabase/content-type";

function isSafePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").trim();
  if (normalized.includes("..")) return false;
  return true;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; path?: string[] }> }
) {
  const { id, path: pathSegments } = await params;
  const filePath = pathSegments?.length ? pathSegments.join("/") : "index.html";
  if (!isSafePath(filePath)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  const bucket = getStorageBucket();
  const storagePath = `projects/${id}/site/${filePath}`;
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(storagePath);
  if (error || !data) {
    return new NextResponse(null, { status: 404 });
  }
  const contentType = getContentType(filePath);
  return new NextResponse(data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
