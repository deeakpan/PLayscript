import type { MatchStatus } from "@/lib/fixtures-shared";

/** First two hours after kickoff: treat as live for UI if the feed still says scheduled. */
export const LIVE_WINDOW_AFTER_KICKOFF_MS = 120 * 60 * 1000;

/**
 * TheSportsDB can lag with `strStatus`; for ~120m after kickoff we show **Live** instead of
 * **Scheduled** when the stored status is still `open`.
 */
export function deriveDisplayMatchStatus(
  apiStatus: MatchStatus,
  kickoffMs: number,
  nowMs: number,
): MatchStatus {
  if (apiStatus === "finished") return "finished";
  if (apiStatus === "live") return "live";
  if (apiStatus === "closing_soon") return "closing_soon";

  if (
    Number.isFinite(kickoffMs) &&
    nowMs >= kickoffMs &&
    nowMs < kickoffMs + LIVE_WINDOW_AFTER_KICKOFF_MS
  ) {
    return "live";
  }

  return "open";
}
