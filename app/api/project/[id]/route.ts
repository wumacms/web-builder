import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getStorageBucket } from "@/lib/supabase/server";

async function listAllStoragePaths(
  bucket: string,
  prefix: string
): Promise<string[]> {
  const { data: items, error } = await supabaseAdmin.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });
  if (error) throw new Error(error.message);
  if (!items?.length) return [];
  const paths: string[] = [];
  for (const item of items) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id != null) {
      paths.push(fullPath);
    } else {
      const nested = await listAllStoragePaths(bucket, fullPath);
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
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, title, status, github_repo_url, github_pages_url, created_at, updated_at")
    .eq("id", id)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: project, error: fetchErr } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("id", id)
      .single();
    if (fetchErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const bucket = getStorageBucket();
    const prefix = `projects/${id}/site`;
    const paths = await listAllStoragePaths(bucket, prefix);
    if (paths.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < paths.length; i += batchSize) {
        const batch = paths.slice(i, i + batchSize);
        const { error: removeErr } = await supabaseAdmin.storage
          .from(bucket)
          .remove(batch);
        if (removeErr) {
          console.error("Storage remove error:", removeErr);
          return NextResponse.json(
            { error: "删除网站文件失败：" + removeErr.message },
            { status: 500 }
          );
        }
      }
    }
    const { error: deleteErr } = await supabaseAdmin
      .from("projects")
      .delete()
      .eq("id", id);
    if (deleteErr) {
      return NextResponse.json(
        { error: "删除项目记录失败：" + deleteErr.message },
        { status: 500 }
      );
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
