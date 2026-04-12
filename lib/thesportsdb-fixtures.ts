import "server-only";

import { unstable_cache } from "next/cache";

import {
  ALL_LEAGUES_ID,
  type FixtureRow,
  getSportKeyForSourceLeagueId,
  UPCOMING_LEAGUE_ID_SET,
  UPCOMING_LEAGUES,
} from "@/lib/fixtures-shared";

/** TheSportsDB free tier — key `123` in path (public demo key from docs). */

export const THESPORTSDB_JSON_BASE =
  "https://www.thesportsdb.com/api/v1/json/123";

/** Data-cache TTL for listings + per-event fixture resolution (~3 origin hits/min at peak). */
export const THESPORTSDB_LIST_REVALIDATE_SEC = 20;

export type FetchFixtureByEventIdOptions = {
  /** When set, scan that league’s `eventsnextleague` list first (same source as the home table). */
  leagueId?: string | null;
};

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
  intHomeScore?: string | number | null;
  intAwayScore?: string | number | null;
};

function parseApiGoal(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
  return Number.isFinite(n) && !Number.isNaN(n) ? n : null;
}

function mapStrStatus(strStatus: string | null | undefined): FixtureRow["status"] {
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
  // US leagues often use "FT"; baseball/basketball use "Final" etc.
  if (
    s === "ft" ||
    s === "final" ||
    s.includes("finished") ||
    s.includes("full time") ||
    s.includes("after extra time") ||
    s.includes("after golden goal") ||
    s.includes("after penalties") ||
    s.includes("match finished") ||
    s.includes("finalizado") ||
    s.includes("game over")
  ) {
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
  const sportKey = getSportKeyForSourceLeagueId(lid);
  const hs = parseApiGoal(ev.intHomeScore);
  const as = parseApiGoal(ev.intAwayScore);
  const scores =
    hs !== null && as !== null ? { homeScore: hs, awayScore: as } : {};

  const detail = ev.strStatus?.trim();
  return {
    id,
    league: (ev.strLeague ?? "—").trim() || "—",
    home,
    away,
    sportKey,
    kickoffUtc: kickoffUtcIso(ev),
    status: mapStrStatus(ev.strStatus),
    ...(lid ? { sourceLeagueId: lid } : {}),
    ...scores,
    ...(detail ? { statusDetail: detail } : {}),
  };
}

export async function fetchUpcomingFixtures(leagueId: string): Promise<FixtureRow[]> {
  const url = `${THESPORTSDB_JSON_BASE}/eventsnextleague.php?id=${encodeURIComponent(leagueId)}`;
  const res = await fetch(url, {
    next: { revalidate: THESPORTSDB_LIST_REVALIDATE_SEC },
  });
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

/** Merge `eventsnextleague` for many ids (dedupe by source league + event id). */
export async function fetchUpcomingFixturesMerged(
  leagueIds: readonly string[],
): Promise<FixtureRow[]> {
  if (leagueIds.length === 0) return [];
  const lists = await Promise.all(leagueIds.map((id) => fetchUpcomingFixtures(id)));
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

export async function fetchUpcomingFixturesAll(): Promise<FixtureRow[]> {
  return fetchUpcomingFixturesMerged(UPCOMING_LEAGUES.map((l) => l.id));
}

/**
 * Resolve a fixture by TheSportsDB `idEvent` (our `FixtureRow.id`).
 *
 * Order: (1) upcoming list for `leagueId` hint if valid, (2) merged upcoming across configured
 * leagues, (3) `lookupevent.php` **only** if the API returns the same `idEvent` (free tier often
 * maps new ids to unrelated historical events).
 */
async function fetchFixtureByEventIdUncached(
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
  const res = await fetch(lookupUrl, {
    next: { revalidate: THESPORTSDB_LIST_REVALIDATE_SEC },
  });
  if (!res.ok) return null;
  const json: { events?: ApiEvent[] | null } = await res.json();
  const ev = json.events?.[0];
  const returnedId = ev?.idEvent?.trim();
  if (!ev || returnedId !== id) return null;
  return mapApiEventToFixture(ev);
}

/** One shared server cache entry per `idEvent` (all visitors reuse for `THESPORTSDB_LIST_REVALIDATE_SEC`). */
export async function fetchFixtureByEventId(
  eventId: string,
  options?: FetchFixtureByEventIdOptions,
): Promise<FixtureRow | null> {
  const id = eventId.trim();
  if (!id) return null;

  return unstable_cache(
    async () => fetchFixtureByEventIdUncached(id, options),
    ["thesportsdb-fixture", id],
    { revalidate: THESPORTSDB_LIST_REVALIDATE_SEC },
  )();
}
