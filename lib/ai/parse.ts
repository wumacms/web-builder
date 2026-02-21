export type PageEntry = { path: string; content: string };
export type AssetEntry = { path: string; content: string };
export type ParsedSite = { pages: PageEntry[]; assets: AssetEntry[] };

function isSafePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").trim();
  if (normalized.includes("..")) return false;
  if (normalized.startsWith("/")) return false;
  return normalized.length > 0 && normalized.length < 256;
}

function stripMarkdownCodeBlock(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```json")) s = s.slice(7);
  else if (s.startsWith("```")) s = s.slice(3);
  if (s.endsWith("```")) s = s.slice(0, -3);
  return s.trim();
}

export function parseSiteJson(raw: string): ParsedSite {
  const s = stripMarkdownCodeBlock(raw);
  let data: { pages?: PageEntry[]; assets?: AssetEntry[] };
  try {
    data = JSON.parse(s) as { pages?: PageEntry[]; assets?: AssetEntry[] };
  } catch {
    throw new Error("Invalid JSON from AI");
  }
  const pages = Array.isArray(data.pages) ? data.pages : [];
  const assets = Array.isArray(data.assets) ? data.assets : [];
  if (pages.length === 0) throw new Error("AI output has no pages");
  for (const p of pages) {
    if (!p.path || typeof p.content !== "string") throw new Error("Invalid page entry");
    if (!isSafePath(p.path)) throw new Error("Unsafe path: " + p.path);
  }
  for (const a of assets) {
    if (!a.path || typeof a.content !== "string") throw new Error("Invalid asset entry");
    if (!isSafePath(a.path)) throw new Error("Unsafe path: " + a.path);
  }
  return { pages, assets };
}
