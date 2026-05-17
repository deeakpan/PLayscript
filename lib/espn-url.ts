/** ESPN Site API v2 base — see `espn-api-docs.md`. */
export const ESPN_SITE_API = "https://site.api.espn.com/apis/site/v2/sports";

export function espnScoreboardUrl(leagueSlug: string, eventId: string): string {
  const league = leagueSlug.replace(/^\/+/, "");
  return `${ESPN_SITE_API}/${league}/scoreboard/${encodeURIComponent(eventId.trim())}`;
}

export function espnSummaryUrl(leagueSlug: string, eventId: string): string {
  const league = leagueSlug.replace(/^\/+/, "");
  return `${ESPN_SITE_API}/${league}/summary?event=${encodeURIComponent(eventId.trim())}`;
}

/** `dates=YYYYMMDD` or `YYYYMMDD-YYYYMMDD` (inclusive-style range on scoreboard). */
export function espnScoreboardRangeUrl(leagueSlug: string, startYmd: string, endYmd: string): string {
  const league = leagueSlug.replace(/^\/+/, "");
  const range = startYmd === endYmd ? startYmd : `${startYmd}-${endYmd}`;
  return `${ESPN_SITE_API}/${league}/scoreboard?dates=${range}`;
}

export function formatUtcYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** Primary match key for v2 `registerMatch` / `resolve-v2-match` (soccer → summary; US sports → scoreboard). */
export function espnPrimaryMatchUrl(leagueSlug: string, eventId: string, sportKey: string): string {
  if (sportKey === "soccer") return espnSummaryUrl(leagueSlug, eventId);
  return espnScoreboardUrl(leagueSlug, eventId);
}
