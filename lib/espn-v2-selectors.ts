/**
 * ESPN JSON paths for Somnia `fetchUint` / `fetchString` — see `espn-api-docs.md`
 * and `lib/espn-mock-hardcoded.generated.json` (EPL 740902 probe).
 *
 * Scoreboard: final scores + NBA/NFL period linescores.
 * Summary (soccer): header half goals + boxscore card totals.
 */

export const ESPN_SCOREBOARD_SELECTORS = {
  homeScore: "competitions[0].competitors[0].score",
  awayScore: "competitions[0].competitors[1].score",
  status: "competitions[0].status.type.name",
  homeTeam: "competitions[0].competitors[0].team.displayName",
  awayTeam: "competitions[0].competitors[1].team.displayName",
  homeQ1: "competitions[0].competitors[0].linescores[0].displayValue",
  homeQ2: "competitions[0].competitors[0].linescores[1].displayValue",
  awayQ1: "competitions[0].competitors[1].linescores[0].displayValue",
  awayQ2: "competitions[0].competitors[1].linescores[1].displayValue",
} as const;

/** Soccer summary — 1st-half goals from `header` (not `boxscore.teams` linescores). */
export const ESPN_SOCCER_SUMMARY_SELECTORS = {
  htHome: "header.competitions[0].competitors[0].linescores[0].displayValue",
  htAway: "header.competitions[0].competitors[1].linescores[0].displayValue",
  yellowHome: "boxscore.teams[0].statistics[1].displayValue",
  yellowAway: "boxscore.teams[1].statistics[1].displayValue",
  redHome: "boxscore.teams[0].statistics[2].displayValue",
  redAway: "boxscore.teams[1].statistics[2].displayValue",
} as const;

export type EspnScoreboardSelectorKey = keyof typeof ESPN_SCOREBOARD_SELECTORS;
export type EspnSoccerSummarySelectorKey = keyof typeof ESPN_SOCCER_SUMMARY_SELECTORS;
