/**
 * Client-safe TheSportsDB URL helpers (no `server-only`).
 * Keep in sync with on-chain `registerMatch` URLs (e.g. `lookupevent.php?id=…`).
 */

export function getThesportsdbApiKeyForClient(): string {
  return (process.env.NEXT_PUBLIC_THESPORTSDB_API_KEY ?? "123").trim() || "123";
}

export function getThesportsdbJsonBaseForClient(): string {
  return `https://www.thesportsdb.com/api/v1/json/${getThesportsdbApiKeyForClient()}`;
}

/** Same shape as `register-playscript-thesportsdb-events.ts` on-chain JSON URL. */
export function buildLookupeventApiUrl(eventId: string): string {
  const id = eventId.trim();
  return `${getThesportsdbJsonBaseForClient()}/lookupevent.php?id=${encodeURIComponent(id)}`;
}
