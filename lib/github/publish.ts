import { Octokit } from "@octokit/rest";
import { supabaseAdmin, getStorageBucket } from "@/lib/supabase/server";

const bucket = getStorageBucket();

async function listAllFilesInPrefix(prefix: string): Promise<string[]> {
  const { data: items, error } = await supabaseAdmin.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });
  if (error) throw new Error(error.message);
  if (!items?.length) return [];
  const files: string[] = [];
  for (const item of items) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id != null) files.push(fullPath);
    else {
      const nested = await listAllFilesInPrefix(fullPath);
      files.push(...nested);
    }
  }
  return files;
}

export type PublishResult = { repoUrl: string; pagesUrl: string };

export async function publishToGitHub(
  projectId: string,
  githubToken: string
): Promise<PublishResult> {
  const octokit = new Octokit({ auth: githubToken });
  const { data: me } = await octokit.rest.users.getAuthenticated();
  const owner = me.login;
  const repoName = `wb-${projectId.slice(0, 8)}`;
  try {
    await octokit.repos.get({ owner, repo: repoName });
    throw new Error("Repository already exists: " + repoName);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status !== 404) throw err;
  }
  const { data: repo } = await octokit.repos.createForAuthenticatedUser({
    name: repoName,
    description: "Generated static site",
    private: false,
    auto_init: false,
  });
  const prefix = `projects/${projectId}/site`;
  const filePaths = await listAllFilesInPrefix(prefix);
  if (filePaths.length === 0) throw new Error("No files to publish");
  const tree = await Promise.all(
    filePaths.map(async (storagePath) => {
      const { data: blob } = await supabaseAdmin.storage.from(bucket).download(storagePath);
      if (!blob) throw new Error("Download failed: " + storagePath);
      const content = Buffer.from(await blob.arrayBuffer()).toString("base64");
      const path = storagePath.replace(prefix + "/", "");
      const { data } = await octokit.rest.git.createBlob({
        owner,
        repo: repoName,
        content,
        encoding: "base64",
      });
      return { path, sha: data.sha, mode: "100644" as const, type: "blob" as const };
    })
  );
  const { data: commitTree } = await octokit.rest.git.createTree({
    owner,
    repo: repoName,
    tree,
  });
  const { data: commit } = await octokit.rest.git.createCommit({
    owner,
    repo: repoName,
    message: "Initial commit: generated site",
    tree: commitTree.sha,
  });
  await octokit.rest.git.createRef({
    owner,
    repo: repoName,
    ref: "refs/heads/main",
    sha: commit.sha,
  });
  const pagesUrl = `https://${owner}.github.io/${repoName}`;
  return { repoUrl: repo.html_url ?? "", pagesUrl };
}
