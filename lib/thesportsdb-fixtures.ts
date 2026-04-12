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

/** Data-cache TTL for listings + per-event fixture resolution. */
export const THESPORTSDB_LIST_REVALIDATE_SEC = 90;

const RETRYABLE_STATUS = new Set([408, 429, 502, 503]);
const FETCH_MAX_ATTEMPTS = 6;
const FETCH_BASE_DELAY_MS = 900;
/** Space out league calls so we do not burst TheSportsDB free tier (429). */
const BETWEEN_LEAGUE_MS = 320;
/** After retries, treat these as empty feed instead of failing the whole request (home / scripts). */
const SOFT_FAIL_STATUS = new Set([429, 502, 503]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with backoff on rate-limit / transient errors. Honors `Retry-After` when sensible.
 */
async function fetchTheSportsDb(
  url: string,
  init?: RequestInit & { next?: { revalidate?: number | false } },
): Promise<Response> {
  let last: Response | undefined;
  for (let attempt = 0; attempt < FETCH_MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, init);
    last = res;
    if (res.ok) return res;
    if (!RETRYABLE_STATUS.has(res.status)) return res;

    if (attempt === FETCH_MAX_ATTEMPTS - 1) break;

    let delay = FETCH_BASE_DELAY_MS * 2 ** attempt;
    const ra = res.headers.get("retry-after");
    if (ra) {
      const sec = Number.parseInt(ra, 10);
      if (Number.isFinite(sec) && sec >= 0) {
        delay = Math.min(15_000, Math.max(delay, sec * 1000));
      }
    }
    delay += Math.floor(Math.random() * 400);
    await sleep(delay);
  }
  return last!;
}

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
    s.includes("quarter") ||
    s.includes("qtr") ||
    s.includes("overtime") ||
    s.includes(" ot") ||
    s.endsWith(" ot") ||
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
  const res = await fetchTheSportsDb(url, {
    next: { revalidate: THESPORTSDB_LIST_REVALIDATE_SEC },
  });
  if (!res.ok) {
    if (SOFT_FAIL_STATUS.has(res.status)) {
      return [];
    }
    throw new Error(`TheSportsDB HTTP ${res.status} (${url})`);
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
  const lists: FixtureRow[][] = [];
  for (let i = 0; i < leagueIds.length; i++) {
    if (i > 0) await sleep(BETWEEN_LEAGUE_MS);
    lists.push(await fetchUpcomingFixtures(leagueIds[i]!));
  }
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
 * Order: (1) upcoming list for `leagueId` hint if valid, (2) `lookupevent.php` when `idEvent`
 * matches (cheap single call — used heavily by scripts API), (3) merged upcoming across leagues
 * only if still missing (soft-fails per league on 429 so we do not crash the app).
 */
async function tryLookupeventFixture(eventId: string): Promise<FixtureRow | null> {
  const id = eventId.trim();
  const lookupUrl = `${THESPORTSDB_JSON_BASE}/lookupevent.php?id=${encodeURIComponent(id)}`;
  const res = await fetchTheSportsDb(lookupUrl, {
    next: { revalidate: THESPORTSDB_LIST_REVALIDATE_SEC },
  });
  if (!res.ok) return null;
  const json: { events?: ApiEvent[] | null } = await res.json();
  const ev = json.events?.[0];
  const returnedId = ev?.idEvent?.trim();
  if (!ev || returnedId !== id) return null;
  return mapApiEventToFixture(ev);
}

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
  } else {
    const fromLookupFirst = await tryLookupeventFixture(id);
    if (fromLookupFirst) return fromLookupFirst;
  }

  const fromLookup = useHint ? await tryLookupeventFixture(id) : null;
  if (fromLookup) return fromLookup;

  const merged = await fetchUpcomingFixturesAll();
  const fromMerged = merged.find((f) => f.id === id);
  if (fromMerged) return fromMerged;

  return null;
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
