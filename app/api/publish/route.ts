import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { publishToGitHub } from "@/lib/github/publish";

const Body = z.object({
  projectId: z.string().uuid(),
  githubToken: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { projectId, githubToken } = parsed.data;
    const token = githubToken ?? process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "GitHub token required. Set GITHUB_TOKEN or pass githubToken." },
        { status: 400 }
      );
    }
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .select("id, status")
      .eq("id", projectId)
      .single();
    if (projErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.status !== "ready" && project.status !== "published") {
      return NextResponse.json(
        { error: "Project is not ready to publish. Generate the site first." },
        { status: 400 }
      );
    }
    await supabaseAdmin
      .from("projects")
      .update({ status: "publishing", updated_at: new Date().toISOString() })
      .eq("id", projectId);
    let result: { repoUrl: string; pagesUrl: string };
    try {
      result = await publishToGitHub(projectId, token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Publish failed";
      await supabaseAdmin
        .from("projects")
        .update({
          status: "error",
          last_error: msg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    await supabaseAdmin
      .from("projects")
      .update({
        status: "published",
        github_repo_url: result.repoUrl,
        github_pages_url: result.pagesUrl,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
    return NextResponse.json({
      repoUrl: result.repoUrl,
      pagesUrl: result.pagesUrl,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
