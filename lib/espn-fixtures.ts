import "server-only";

import { unstable_cache } from "next/cache";

import {
  type FixtureRow,
  getSportKeyForSourceLeagueId,
  type MatchStatus,
  type ScriptSportKey,
} from "@/lib/fixtures-shared";
import { EspnFetchUnavailableError, fetchEspn, isEspnNetworkError } from "@/lib/espn-fetch";
import {
  espnDevMockEnabled,
  findEspnDevMockFixtureByEventId,
  getEspnDevMockFixtures,
} from "@/lib/espn-fixtures-dev-mock";
import { espnScoreboardRangeUrl, formatUtcYmd } from "@/lib/espn-url";

export const ESPN_LIST_REVALIDATE_SEC = 120;

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

/** Days forward from today (UTC) included in scoreboard range. */
export const ESPN_FIXTURE_WINDOW_DAYS = 14;

type EspnCompetitor = {
  homeAway?: string;
  score?: string;
  team?: { displayName?: string };
};

type EspnCompetition = {
  id?: string;
  date?: string;
  status?: { type?: { name?: string; state?: string; completed?: boolean } };
  competitors?: EspnCompetitor[];
};

type EspnEvent = {
  id?: string;
  date?: string;
  name?: string;
  shortName?: string;
  competitions?: EspnCompetition[];
};

function mapEspnStatus(comp?: EspnCompetition): MatchStatus {
  const name = comp?.status?.type?.name ?? "";
  const state = comp?.status?.type?.state ?? "";
  const n = name.toUpperCase();
  if (n.includes("IN_PROGRESS") || n.includes("HALFTIME") || state === "in") return "live";
  if (comp?.status?.type?.completed || n.includes("FULL") || n.includes("FINAL") || state === "post") {
    return "finished";
  }
  if (n.includes("POSTPONED") || n.includes("DELAYED") || n.includes("CANCELED")) return "closing_soon";
  return "open";
}

function parseScore(s: string | undefined): number | null {
  if (s === undefined || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function kickoffFromEvent(ev: EspnEvent, comp: EspnCompetition): string {
  const raw = comp.date ?? ev.date;
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

export function mapEspnEventToFixture(ev: EspnEvent, leagueLabel: string, leagueSlug: string): FixtureRow | null {
  const comp = ev.competitions?.[0];
  if (!comp) return null;
  const home = comp.competitors?.find((c) => c.homeAway === "home");
  const away = comp.competitors?.find((c) => c.homeAway === "away");
  const homeName = home?.team?.displayName?.trim();
  const awayName = away?.team?.displayName?.trim();
  if (!home || !away || !homeName || !awayName) return null;
  const id = ev.id?.trim() ?? comp.id?.trim();
  if (!id) return null;

  const hs = parseScore(home.score);
  const as = parseScore(away.score);
  const status = mapEspnStatus(comp);

  return {
    id,
    league: leagueLabel,
    home: homeName,
    away: awayName,
    sportKey: getSportKeyForSourceLeagueId(leagueSlug),
    kickoffUtc: kickoffFromEvent(ev, comp),
    status,
    sourceLeagueId: leagueSlug,
    ...(hs !== null && as !== null ? { homeScore: hs, awayScore: as } : {}),
    statusDetail: comp.status?.type?.name ?? undefined,
  };
}

async function parseEspnJsonResponse(res: Response, url: string): Promise<unknown> {
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (!ct.includes("json") && text.trimStart().startsWith("<")) {
    throw new Error(
      `ESPN returned HTML instead of JSON (HTTP ${res.status}). The feed may be blocked or the URL is wrong.`,
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`ESPN response was not valid JSON (HTTP ${res.status}) for ${url}`);
  }
}

async function fetchEspnScoreboardJson(leagueSlug: string, startYmd: string, endYmd: string) {
  const url = espnScoreboardRangeUrl(leagueSlug, startYmd, endYmd);
  const res = await fetchEspn(url, { next: { revalidate: ESPN_LIST_REVALIDATE_SEC } });
  if (!res.ok) throw new Error(`ESPN HTTP ${res.status} (${url})`);
  const json = (await parseEspnJsonResponse(res, url)) as {
    events?: EspnEvent[];
    leagues?: { name?: string }[];
  };
  return json;
}

export async function fetchEspnFixturesForLeague(
  leagueSlug: string,
  leagueLabel: string,
  windowDays = ESPN_FIXTURE_WINDOW_DAYS,
): Promise<FixtureRow[]> {
  if (espnDevMockEnabled()) {
    return getEspnDevMockFixtures(leagueSlug);
  }

  const now = new Date();
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + windowDays);
  const startYmd = formatUtcYmd(now);
  const endYmd = formatUtcYmd(end);

  const json = await fetchEspnScoreboardJson(leagueSlug, startYmd, endYmd);
  const events = json.events ?? [];
  const out: FixtureRow[] = [];

  for (const ev of events) {
    const row = mapEspnEventToFixture(ev, leagueLabel, leagueSlug);
    if (row) out.push(row);
  }

  out.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
  return out;
}

export async function fetchEspnFixtureByEventId(
  leagueSlug: string,
  eventId: string,
): Promise<FixtureRow | null> {
  const id = eventId.trim();
  if (espnDevMockEnabled()) {
    return findEspnDevMockFixtureByEventId(id, leagueSlug);
  }

  const url = `${ESPN_BASE}/${leagueSlug.replace(/^\/+/, "")}/scoreboard/${encodeURIComponent(id)}`;

  try {
    const res = await fetchEspn(url, { next: { revalidate: ESPN_LIST_REVALIDATE_SEC } });
    if (!res.ok) return null;
    const json = (await parseEspnJsonResponse(res, url)) as {
      events?: EspnEvent[];
      competitions?: EspnCompetition[];
      date?: string;
    };
    const ev: EspnEvent | null =
      json.events?.[0] ??
      (json.competitions?.length
        ? { id, competitions: json.competitions, date: json.date }
        : null);
    if (!ev) return null;
    return mapEspnEventToFixture(ev, leagueSlug, leagueSlug);
  } catch (e) {
    if (isEspnNetworkError(e)) {
      const mock = findEspnDevMockFixtureByEventId(id, leagueSlug);
      if (mock) return mock;
      throw e instanceof EspnFetchUnavailableError
        ? e
        : new EspnFetchUnavailableError(
            e instanceof Error ? e.message : "ESPN unreachable",
          );
    }
    throw e;
  }
}

export function fetchEspnFixturesCached(leagueSlug: string, leagueLabel: string) {
  return unstable_cache(
    async () => fetchEspnFixturesForLeague(leagueSlug, leagueLabel),
    ["espn-fixtures", leagueSlug, String(ESPN_FIXTURE_WINDOW_DAYS)],
    { revalidate: ESPN_LIST_REVALIDATE_SEC },
  )();
}
