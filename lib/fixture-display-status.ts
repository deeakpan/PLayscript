import type { MatchStatus, ScriptSportKey } from "@/lib/fixtures-shared";

/** Extra time after typical match length before we assume the fixture has ended if the API still says “open”. */
export const POST_MATCH_BUFFER_MS = 20 * 60 * 1000;

/**
 * Rough televised length from kickoff (used only for UI when TheSportsDB lags on `strStatus`).
 * Football (soccer): 120m as requested; other sports get plausible defaults + buffer below.
 */
export function typicalMatchDurationMs(sportKey: ScriptSportKey): number {
  const minutes =
    sportKey === "soccer"
      ? 120
      : sportKey === "basketball"
        ? 150
        : sportKey === "american_football"
          ? 210
          : sportKey === "baseball"
            ? 240
            : 120;
  return minutes * 60 * 1000;
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
