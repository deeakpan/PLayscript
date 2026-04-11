export const ALL_LEAGUES_ID = "all";

export const UPCOMING_LEAGUES = [
  { id: "4480", label: "UEFA Champions League" },
  { id: "4328", label: "English Premier League" },
  { id: "4330", label: "Scottish Premier League" },
  { id: "4335", label: "Spanish La Liga" },
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
  /** ISO-8601 instant in UTC (see `kickoffUtcIso` in server mapper). */
  kickoffUtc: string;
  status: MatchStatus;
  /** TheSportsDB `idLeague` when present — disambiguates links when `idEvent` alone is not unique. */
  sourceLeagueId?: string;
  /** Present when the API reports line goals (live or finished). */
  homeScore?: number;
  awayScore?: number;
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
