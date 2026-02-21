import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { chatCompletion } from "@/lib/ai/deepseek";
import { parseSiteJson, type ParsedSite } from "@/lib/ai/parse";
import { uploadSiteToStorage } from "@/lib/site-builder/upload";

const ChatBody = z.object({
  message: z.string().min(1).max(2000),
  projectId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ChatBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { message, projectId: existingId } = parsed.data;

    let projectId: string;
    let messages: { role: "user" | "assistant"; content: string }[];

    if (existingId) {
      const { data: project, error: projErr } = await supabaseAdmin
        .from("projects")
        .select("id, status")
        .eq("id", existingId)
        .single();
      if (projErr || !project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      if (project.status === "ready") {
        return NextResponse.json(
          { error: "网站已生成，不支持通过 AI 再次调整，请使用「编辑内容」进行可视化修改。" },
          { status: 400 }
        );
      }
      projectId = project.id;
      const { data: inserted } = await supabaseAdmin
        .from("messages")
        .insert({ project_id: projectId, role: "user", content: message })
        .select("id")
        .single();
      if (!inserted) {
        return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
      }
      const { data: all } = await supabaseAdmin
        .from("messages")
        .select("role, content")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      messages = (all ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    } else {
      const title = message.slice(0, 50);
      const { data: project, error: projErr } = await supabaseAdmin
        .from("projects")
        .insert({ title, status: "draft" })
        .select("id")
        .single();
      if (projErr || !project) {
        return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
      }
      projectId = project.id;
      const { error: msgErr } = await supabaseAdmin
        .from("messages")
        .insert({ project_id: projectId, role: "user", content: message });
      if (msgErr) {
        return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
      }
      messages = [{ role: "user", content: message }];
    }

    const userPrompt =
      messages.length === 1
        ? `用户需求：\n${message}\n\n请根据以上需求生成完整静态网站（仅使用 Tailwind CSS），直接输出 JSON，不要其它说明。`
        : `对话历史：\n${messages.map((m) => `${m.role}: ${m.content}`).join("\n")}\n\n请根据以上需求生成或更新完整静态网站（仅使用 Tailwind CSS），直接输出 JSON。`;

    let assistantContent: string;
    try {
      assistantContent = await chatCompletion([{ role: "user", content: userPrompt }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI request failed";
      await supabaseAdmin
        .from("projects")
        .update({ status: "error", last_error: msg, updated_at: new Date().toISOString() })
        .eq("id", projectId);
      return NextResponse.json({ error: msg, projectId }, { status: 500 });
    }

    let siteJson: ParsedSite;
    try {
      siteJson = parseSiteJson(assistantContent);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Parse failed";
      await supabaseAdmin
        .from("projects")
        .update({ status: "error", last_error: msg, updated_at: new Date().toISOString() })
        .eq("id", projectId);
      await supabaseAdmin.from("messages").insert({
        project_id: projectId,
        role: "assistant",
        content: "生成失败：" + msg,
      });
      return NextResponse.json({ error: msg, projectId }, { status: 500 });
    }

    await supabaseAdmin
      .from("projects")
      .update({ status: "generating", updated_at: new Date().toISOString() })
      .eq("id", projectId);

    try {
      await uploadSiteToStorage(projectId, siteJson);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      await supabaseAdmin
        .from("projects")
        .update({ status: "error", last_error: msg, updated_at: new Date().toISOString() })
        .eq("id", projectId);
      return NextResponse.json({ error: msg, projectId }, { status: 500 });
    }

    await supabaseAdmin
      .from("projects")
      .update({ status: "ready", updated_at: new Date().toISOString() })
      .eq("id", projectId);

    const { data: assistantRow } = await supabaseAdmin
      .from("messages")
      .insert({
        project_id: projectId,
        role: "assistant",
        content: "站点已生成，共 " + siteJson.pages.length + " 个页面。",
      })
      .select("id")
      .single();

    return NextResponse.json({
      projectId,
      messageId: assistantRow?.id ?? null,
      status: "completed",
      previewPath: `/api/project/${projectId}/site/index.html`,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
