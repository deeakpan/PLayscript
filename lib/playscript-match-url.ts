/** Normalize TheSportsDB / on-chain JSON URLs for equality checks. */
export function normalizeMatchUrl(u: string): string {
  const t = u.trim();
  try {
    const x = new URL(t);
    x.hash = "";
    const path = x.pathname.replace(/\/+$/, "") || "/";
    return `${x.protocol}//${x.host.toLowerCase()}${path}${x.search}`.toLowerCase();
  } catch {
    return t.toLowerCase().replace(/\/+$/, "");
  }
}

export function extractMatchUrlFromRead(row: unknown): string {
  if (row && typeof row === "object" && "url" in row) {
    const u = (row as { url?: unknown }).url;
    if (typeof u === "string") return u;
  }
  if (Array.isArray(row) && typeof row[3] === "string") return row[3]!;
  return "";
}
