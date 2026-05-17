import type { FixtureRow, MatchStatus, ScriptSportKey } from "@/lib/fixtures-shared";

/** Home fixtures table filter (client-side). */
export type FixtureListFilter = "all" | "scheduled" | "started" | "finished";

export const FIXTURE_LIST_FILTER_OPTIONS: { id: FixtureListFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "scheduled", label: "Scheduled" },
  { id: "started", label: "Started" },
  { id: "finished", label: "Finished" },
];

/** Extra time after typical match length before we assume the fixture has ended if the API still says “open”. */
export const POST_MATCH_BUFFER_MS = 20 * 60 * 1000;

/**
 * Rough televised length from kickoff (UI status inference + v2 `finalizeDelaySec` for non-soccer).
 * Football (soccer): 120m; longer codes get proportionally longer defaults.
 */
export function typicalMatchDurationMinutes(sportKey: ScriptSportKey): number {
  switch (sportKey) {
    case "soccer":
      return 120;
    case "basketball":
      return 150;
    case "american_football":
      return 210;
    case "baseball":
      return 240;
    default: {
      const _x: never = sportKey;
      return _x;
    }
  }
}

export function typicalMatchDurationMs(sportKey: ScriptSportKey): number {
  return typicalMatchDurationMinutes(sportKey) * 60 * 1000;
}

/** Typical length + 20m buffer — same window for “Live vs Scheduled” and “Ended” in lists. */
export function matchInferenceWindowMs(sportKey: ScriptSportKey): number {
  return typicalMatchDurationMs(sportKey) + POST_MATCH_BUFFER_MS;
}

/**
 * TheSportsDB can lag with `strStatus`. After kickoff, within the sport window we show **Live**
 * instead of **Scheduled** when the API still says `open`. After the window, if it still says `open`,
 * we show **Finished** so the table does not stay on “Scheduled” forever.
 */
export function deriveDisplayMatchStatus(
  apiStatus: MatchStatus,
  kickoffMs: number,
  nowMs: number,
  sportKey: ScriptSportKey = "soccer",
): MatchStatus {
  if (apiStatus === "finished") return "finished";
  if (apiStatus === "live") return "live";
  if (apiStatus === "closing_soon") return "closing_soon";

  const windowMs = matchInferenceWindowMs(sportKey);

  if (!Number.isFinite(kickoffMs)) return "open";
  if (nowMs < kickoffMs) return "open";

  if (nowMs < kickoffMs + windowMs) return "live";

  return "finished";
}

export function fixtureMatchesListFilter(
  fixture: FixtureRow,
  filter: FixtureListFilter,
  nowMs: number,
): boolean {
  if (filter === "all") return true;
  const kickoffMs = new Date(fixture.kickoffUtc).getTime();
  const display = deriveDisplayMatchStatus(
    fixture.status,
    kickoffMs,
    nowMs,
    fixture.sportKey,
  );
  if (filter === "scheduled") {
    return display === "open" || display === "closing_soon";
  }
  if (filter === "started") return display === "live";
  if (filter === "finished") return display === "finished";
  return true;
}
