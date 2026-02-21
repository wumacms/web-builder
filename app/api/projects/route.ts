import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 50, 100);
  const offset = Number(req.nextUrl.searchParams.get("offset")) || 0;
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, title, status, github_pages_url, created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ projects: data ?? [] });
}
