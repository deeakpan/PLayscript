export const ALL_LEAGUES_ID = "all";

/** Used for script packs + outcome derivation (see `getScriptSlots`, `deriveSlotOutcomesFromScore`). */
export const SCRIPT_SPORT_KEYS = [
  "soccer",
  "basketball",
  "american_football",
  "baseball",
] as const;
export type ScriptSportKey = (typeof SCRIPT_SPORT_KEYS)[number];

export type UpcomingLeagueConfig = {
  id: string;
  label: string;
  sportKey: ScriptSportKey;
};

/** ESPN `site.api.espn.com` league slugs (see `espn-api-docs.md`). */
export const UPCOMING_LEAGUES: readonly UpcomingLeagueConfig[] = [
  { id: "soccer/uefa.champions", label: "UEFA Champions League", sportKey: "soccer" },
  { id: "soccer/eng.1", label: "English Premier League", sportKey: "soccer" },
  { id: "soccer/eng.2", label: "English Championship", sportKey: "soccer" },
  { id: "soccer/esp.1", label: "Spanish La Liga", sportKey: "soccer" },
  { id: "soccer/ita.1", label: "Italian Serie A", sportKey: "soccer" },
  { id: "soccer/ger.1", label: "German Bundesliga", sportKey: "soccer" },
  { id: "basketball/nba", label: "NBA", sportKey: "basketball" },
  { id: "football/nfl", label: "NFL", sportKey: "american_football" },
  { id: "baseball/mlb", label: "MLB", sportKey: "baseball" },
];

const LEAGUE_ID_TO_SPORT = new Map<string, ScriptSportKey>(
  UPCOMING_LEAGUES.map((l) => [l.id, l.sportKey]),
);

export function getSportKeyForSourceLeagueId(
  id: string | null | undefined,
): ScriptSportKey {
  const t = id?.trim();
  if (t && LEAGUE_ID_TO_SPORT.has(t)) return LEAGUE_ID_TO_SPORT.get(t)!;
  return "soccer";
}

export type LeagueOption = { id: string; label: string; group?: string };

/** Sport filter (first control). Default on the home page: soccer. */
export const SPORT_OPTIONS: { id: ScriptSportKey; label: string }[] = [
  { id: "soccer", label: "Football (soccer)" },
  { id: "basketball", label: "Basketball" },
  { id: "american_football", label: "American football" },
  { id: "baseball", label: "Baseball" },
];

export function isScriptSportKey(v: string): v is ScriptSportKey {
  return (SCRIPT_SPORT_KEYS as readonly string[]).includes(v);
}

/** League picker for a sport: “All leagues” + that sport’s configured competitions. */
export function getLeaguePickerOptions(sportKey: ScriptSportKey): LeagueOption[] {
  return [
    { id: ALL_LEAGUES_ID, label: "All leagues" },
    ...UPCOMING_LEAGUES.filter((l) => l.sportKey === sportKey).map((l) => ({
      id: l.id,
      label: l.label,
    })),
  ];
}

/** ESPN league slugs used when “All leagues” is selected for this sport. */
export function getLeagueIdsForSport(sportKey: ScriptSportKey): readonly string[] {
  return UPCOMING_LEAGUES.filter((l) => l.sportKey === sportKey).map((l) => l.id);
}

/** True if this league id belongs to the given sport (or is “all”). */
export function leagueIdMatchesSport(
  leagueId: string,
  sportKey: ScriptSportKey,
): boolean {
  if (leagueId === ALL_LEAGUES_ID) return true;
  const row = UPCOMING_LEAGUES.find((l) => l.id === leagueId);
  return row?.sportKey === sportKey;
}

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
  /** Which script slot pack / grading rules apply (from configured league id). */
  sportKey: ScriptSportKey;
  /** ISO-8601 instant in UTC (see `kickoffUtcIso` in server mapper). */
  kickoffUtc: string;
  status: MatchStatus;
  /** ESPN league slug (e.g. `soccer/eng.1`) — disambiguates detail links when `id` alone is not unique. */
  sourceLeagueId?: string;
  /** Present when the API reports line goals (live or finished). */
  homeScore?: number;
  awayScore?: number;
  /** ESPN status name (e.g. `STATUS_FIRST_HALF`) for live/detail copy. */
  statusDetail?: string;
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
