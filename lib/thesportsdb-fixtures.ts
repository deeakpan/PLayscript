/** TheSportsDB free tier — key `3` in path (public read). */

export const THESPORTSDB_JSON_BASE =
  "https://www.thesportsdb.com/api/v1/json/3";

export const ALL_LEAGUES_ID = "all";

export const UPCOMING_LEAGUES = [
  { id: "4480", label: "UEFA Champions League" },
  { id: "4328", label: "English Premier League" },
  { id: "4335", label: "Scottish Premier League" },
  { id: "4396", label: "English League 1" },
] as const;

export type LeagueOption = { id: string; label: string };

export const LEAGUE_OPTIONS: LeagueOption[] = [
  { id: ALL_LEAGUES_ID, label: "All leagues" },
  ...UPCOMING_LEAGUES.map((l) => ({ id: l.id, label: l.label })),
];

/** League ids we fetch in “all” merge — use for `?league=` validation. */
export const UPCOMING_LEAGUE_ID_SET = new Set<string>(
  UPCOMING_LEAGUES.map((l) => l.id),
);

export type MatchStatus = "open" | "closing_soon" | "live" | "finished";

export interface FixtureRow {
  id: string;
  league: string;
  home: string;
  away: string;
  /** ISO-8601 instant in UTC (see `kickoffUtcIso`). */
  kickoffUtc: string;
  status: MatchStatus;
  /** TheSportsDB `idLeague` when present — disambiguates links when `idEvent` alone is not unique. */
  sourceLeagueId?: string;
}

type ApiEvent = {
  idEvent?: string;
  idLeague?: string | null;
  strHomeTeam?: string | null;
  strAwayTeam?: string | null;
  strLeague?: string | null;
  dateEvent?: string | null;
  strTime?: string | null;
  strTimestamp?: string | null;
  strStatus?: string | null;
};

function mapStrStatus(strStatus: string | null | undefined): MatchStatus {
  const s = (strStatus ?? "").trim().toLowerCase();
  if (
    s.includes("first half") ||
    s.includes("second half") ||
    s.includes("half time") ||
    s.includes("extra time") ||
    s.includes("penalty") ||
    s === "live"
  ) {
    return "live";
  }
  if (s.includes("finished") || s.includes("full time") || s.includes("after")) {
    return "finished";
  }
  if (s.includes("postponed") || s.includes("delayed") || s.includes("suspended")) {
    return "closing_soon";
  }
  return "open";
}

/**
 * TheSportsDB returns local-style timestamps without a zone. For listings they align with
 * **GMT/UTC civil time**; we store that wall clock as a UTC instant (GMT offset 0 → same as UTC).
 */
function kickoffUtcIso(ev: ApiEvent): string {
  const ts = ev.strTimestamp?.trim();
  if (ts && /^\d{4}-\d{2}-\d{2}/.test(ts)) {
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(ts)) {
      const d = new Date(ts.replace(" ", "T"));
      return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    }
    const normalized = ts.includes("T") ? ts.replace(" ", "T") : ts.replace(" ", "T");
    const base = normalized.slice(0, 19);
    return `${base}Z`;
  }
  const d = ev.dateEvent?.trim();
  const t = (ev.strTime ?? "12:00:00").trim();
  if (d) {
    return `${d}T${t}Z`;
  }
  return new Date().toISOString();
}

export function mapApiEventToFixture(ev: ApiEvent): FixtureRow | null {
  const home = ev.strHomeTeam?.trim();
  const away = ev.strAwayTeam?.trim();
  if (!home || !away) return null;

  const id =
    ev.idEvent?.trim() ||
    `${home}-${away}-${ev.dateEvent ?? ""}-${ev.strTime ?? ""}`;

  const lid = ev.idLeague?.trim();

  return {
    id,
    league: (ev.strLeague ?? "—").trim() || "—",
    home,
    away,
    kickoffUtc: kickoffUtcIso(ev),
    status: mapStrStatus(ev.strStatus),
    ...(lid ? { sourceLeagueId: lid } : {}),
  };
}

/**
 * Path + optional `league` query so the detail page resolves from the same upcoming feed
 * as the list (see `fetchFixtureByEventId`).
 */
export function buildFixtureDetailHref(
  fixtureId: string,
  listFilterLeagueId: string,
  rowSourceLeagueId?: string | null,
): string {
  const base = `/fixtures/${encodeURIComponent(fixtureId)}`;
  const hint =
    listFilterLeagueId !== ALL_LEAGUES_ID
      ? listFilterLeagueId
      : rowSourceLeagueId?.trim() ?? "";
  if (hint && UPCOMING_LEAGUE_ID_SET.has(hint)) {
    return `${base}?league=${encodeURIComponent(hint)}`;
  }
  return base;
}

/** Safe `league` search param for fixture detail (ignored if missing or not a known league id). */
export function parseFixtureLeagueQuery(
  raw: string | string[] | undefined,
): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const t = v?.trim();
  if (!t || t === ALL_LEAGUES_ID || !UPCOMING_LEAGUE_ID_SET.has(t)) return undefined;
  return t;
}

export async function fetchUpcomingFixtures(leagueId: string): Promise<FixtureRow[]> {
  const url = `${THESPORTSDB_JSON_BASE}/eventsnextleague.php?id=${encodeURIComponent(leagueId)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TheSportsDB HTTP ${res.status}`);
  }
  const json: { events?: ApiEvent[] | null } = await res.json();
  const raw = json.events;
  if (!raw || !Array.isArray(raw)) return [];

  const out: FixtureRow[] = [];
  for (const ev of raw) {
    const row = mapApiEventToFixture(ev);
    if (row) out.push(row);
  }
  return out;
}

export async function fetchUpcomingFixturesAll(): Promise<FixtureRow[]> {
  const lists = await Promise.all(
    UPCOMING_LEAGUES.map((l) => fetchUpcomingFixtures(l.id)),
  );
  const merged = new Map<string, FixtureRow>();
  for (const list of lists) {
    for (const f of list) {
      const key = f.sourceLeagueId ? `${f.sourceLeagueId}:${f.id}` : f.id;
      merged.set(key, f);
    }
  }
  return Array.from(merged.values()).sort(
    (a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime(),
  );
}

export type FetchFixtureByEventIdOptions = {
  /** When set, scan that league’s `eventsnextleague` list first (same source as the home table). */
  leagueId?: string | null;
};

/**
 * Resolve a fixture by TheSportsDB `idEvent` (our `FixtureRow.id`).
 *
 * Order: (1) upcoming list for `leagueId` hint if valid, (2) merged upcoming across configured
 * leagues, (3) `lookupevent.php` **only** if the API returns the same `idEvent` (free tier often
 * maps new ids to unrelated historical events).
 */
export async function fetchFixtureByEventId(
  eventId: string,
  options?: FetchFixtureByEventIdOptions,
): Promise<FixtureRow | null> {
  const id = eventId.trim();
  if (!id) return null;

  const hint = options?.leagueId?.trim();
  const useHint =
    hint && hint !== ALL_LEAGUES_ID && UPCOMING_LEAGUE_ID_SET.has(hint);

  if (useHint) {
    const rows = await fetchUpcomingFixtures(hint!);
    const hit = rows.find((f) => f.id === id);
    if (hit) return hit;
  }

  const merged = await fetchUpcomingFixturesAll();
  const fromMerged = merged.find((f) => f.id === id);
  if (fromMerged) return fromMerged;

  const lookupUrl = `${THESPORTSDB_JSON_BASE}/lookupevent.php?id=${encodeURIComponent(id)}`;
  const res = await fetch(lookupUrl, { next: { revalidate: 120 } });
  if (!res.ok) return null;
  const json: { events?: ApiEvent[] | null } = await res.json();
  const ev = json.events?.[0];
  const returnedId = ev?.idEvent?.trim();
  if (!ev || returnedId !== id) return null;
  return mapApiEventToFixture(ev);
}
