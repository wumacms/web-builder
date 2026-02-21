import archiver from "archiver";
import { supabaseAdmin, getStorageBucket } from "@/lib/supabase/server";

async function listAllFilesInPrefix(
  bucket: string,
  prefix: string
): Promise<string[]> {
  const { data: items, error } = await supabaseAdmin.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });
  if (error) throw new Error(error.message);
  if (!items?.length) return [];
  const files: string[] = [];
  for (const item of items) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id != null) {
      files.push(fullPath);
    } else {
      const nested = await listAllFilesInPrefix(bucket, fullPath);
      files.push(...nested);
    }
  }
  return files;
}

export async function createZipStream(projectId: string): Promise<archiver.Archiver> {
  const bucket = getStorageBucket();
  const prefix = `projects/${projectId}/site`;
  const filePaths = await listAllFilesInPrefix(bucket, prefix);
  const archive = archiver("zip", { zlib: { level: 6 } });
  for (const storagePath of filePaths) {
    const { data: blob, error } = await supabaseAdmin.storage.from(bucket).download(storagePath);
    if (error || !blob) continue;
    const entryName = storagePath.replace(prefix + "/", "");
    archive.append(Buffer.from(await blob.arrayBuffer()), { name: entryName });
  }
  archive.finalize();
  return archive;
}
