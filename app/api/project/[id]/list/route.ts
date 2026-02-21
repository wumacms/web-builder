import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getStorageBucket } from "@/lib/supabase/server";

const basePrefix = (id: string) => `projects/${id}/site`;

async function listAllPaths(
  bucket: string,
  prefix: string,
  stripPrefix: string
): Promise<string[]> {
  const { data: items, error } = await supabaseAdmin.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });
  if (error) throw new Error(error.message);
  if (!items?.length) return [];
  const paths: string[] = [];
  const strip = stripPrefix.endsWith("/") ? stripPrefix : stripPrefix + "/";
  for (const item of items) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id != null) {
      paths.push(fullPath.replace(strip, ""));
    } else {
      const nested = await listAllPaths(bucket, fullPath, stripPrefix);
      paths.push(...nested);
    }
  }
  return paths;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bucket = getStorageBucket();
  const prefix = basePrefix(id);
  try {
    const paths = await listAllPaths(bucket, prefix, prefix);
    const files = paths.filter(Boolean).sort();
    return NextResponse.json({ files });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "List failed" },
      { status: 500 }
    );
  }
}
