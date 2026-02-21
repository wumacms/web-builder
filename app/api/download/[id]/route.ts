import { NextRequest, NextResponse } from "next/server";
import { PassThrough, Readable } from "stream";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createZipStream } from "@/lib/zip/stream";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }
  const { data: project, error: projErr } = await supabaseAdmin
    .from("projects")
    .select("id")
    .eq("id", id)
    .single();
  if (projErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  try {
    const archive = await createZipStream(id);
    const pass = new PassThrough();
    archive.pipe(pass);
    const webStream = Readable.toWeb(pass) as ReadableStream;
    const headers = new Headers({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="site-${id}.zip"`,
    });
    return new NextResponse(webStream, { headers });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Download failed" },
      { status: 500 }
    );
  }
}
