import type { ScriptSportKey } from "./fixtures-shared";
import { espnPrimaryMatchUrl, espnScoreboardUrl, espnSummaryUrl } from "./espn-url";
import {
  ESPN_SCOREBOARD_SELECTORS,
  ESPN_SOCCER_SUMMARY_SELECTORS,
} from "./espn-v2-selectors";
import {
  selectV2MarketLegs,
  v2LegKindsTuple,
  V2_LEG_COUNT,
  type PlayscriptV2Leg,
} from "./playscript-v2-legs";

/** Resolve a dotted / bracket JSON path (same shape Somnia JSON API agents use). */
export function pickJsonPath(root: unknown, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cur: unknown = root;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export const V2_ESPN_SCOREBOARD_SELECTORS = ESPN_SCOREBOARD_SELECTORS;
export const V2_ESPN_SOCCER_SUMMARY_SELECTORS = ESPN_SOCCER_SUMMARY_SELECTORS;

/** @deprecated TheSportsDB — use ESPN selectors. */
export const V2_LOOKUP_EVENT_SELECTORS = {
  homeScore: "events[0].intHomeScore",
  awayScore: "events[0].intAwayScore",
  status: "events[0].strStatus",
  homeTeam: "events[0].strHomeTeam",
  awayTeam: "events[0].strAwayTeam",
} as const;

export type V2EspnRegisterUrls = {
  url: string;
  scoreboardUrl: string;
  summaryUrl: string;
};

export function buildV2EspnRegisterUrls(
  leagueSlug: string,
  eventId: string,
  sportKey: ScriptSportKey,
): V2EspnRegisterUrls {
  const scoreboardUrl = espnScoreboardUrl(leagueSlug, eventId);
  const summaryUrl = espnSummaryUrl(leagueSlug, eventId);
  const url = espnPrimaryMatchUrl(leagueSlug, eventId, sportKey);
  return { url, scoreboardUrl, summaryUrl };
}

async function fetchEspnJson(url: string, label: string): Promise<unknown> {
  const res = await fetch(url.trim(), { cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN preflight failed: HTTP ${res.status} (${label})`);
  return res.json();
}

/** Paths must resolve to a non-empty value (e.g. score `"0"` is OK). */
async function assertSelectorsPresent(
  url: string,
  entries: Record<string, string>,
  label: string,
): Promise<void> {
  const json = await fetchEspnJson(url, label);
  const missing: string[] = [];
  for (const [key, path] of Object.entries(entries)) {
    const v = pickJsonPath(json, path);
    if (v === undefined || v === null || v === "") missing.push(`${key} (${path})`);
  }
  if (missing.length > 0) {
    throw new Error(`ESPN JSON missing fields for ${label}: ${missing.join(", ")}`);
  }
}

/** Soccer summary: event exists; HT/card paths can populate after full time (not required now). */
async function assertSoccerSummaryStructure(summaryUrl: string): Promise<void> {
  const json = await fetchEspnJson(summaryUrl, "summary structure");
  const competitors = pickJsonPath(json, "header.competitions[0].competitors");
  if (!Array.isArray(competitors) || competitors.length < 2) {
    throw new Error(
      "ESPN summary missing header.competitions[0].competitors (needed for half-time settlement).",
    );
  }
  const teams = pickJsonPath(json, "boxscore.teams");
  if (!Array.isArray(teams) || teams.length < 2) {
    throw new Error("ESPN summary missing boxscore.teams (needed for card settlement).");
  }
}

/**
 * Before `registerMatch` on an **upcoming** fixture.
 * Only checks fields ESPN usually exposes pre-kickoff (scores often `"0"`).
 * HT / cards / quarters are verified at **settlement** via the on-chain agent.
 */
export async function preflightEspnBeforeRegister(
  urls: V2EspnRegisterUrls,
  sportKey: ScriptSportKey,
): Promise<void> {
  await assertSelectorsPresent(
    urls.scoreboardUrl,
    {
      homeScore: ESPN_SCOREBOARD_SELECTORS.homeScore,
      awayScore: ESPN_SCOREBOARD_SELECTORS.awayScore,
      homeTeam: ESPN_SCOREBOARD_SELECTORS.homeTeam,
      awayTeam: ESPN_SCOREBOARD_SELECTORS.awayTeam,
    },
    "scoreboard",
  );

  if (sportKey === "soccer") {
    await assertSoccerSummaryStructure(urls.summaryUrl);
  }
}

/**
 * Full selector probe (finished match). Use in scripts / `verify:espn-api`, not pre-kickoff register.
 */
export async function assertEspnSettlementSelectorsResolvable(
  urls: V2EspnRegisterUrls,
  sportKey: ScriptSportKey,
): Promise<void> {
  await assertSelectorsPresent(
    urls.scoreboardUrl,
    {
      homeScore: ESPN_SCOREBOARD_SELECTORS.homeScore,
      awayScore: ESPN_SCOREBOARD_SELECTORS.awayScore,
    },
    "scoreboard",
  );
  if (sportKey === "soccer") {
    await assertSelectorsPresent(urls.summaryUrl, { ...ESPN_SOCCER_SUMMARY_SELECTORS }, "summary");
  } else if (sportKey === "basketball" || sportKey === "american_football") {
    await assertSelectorsPresent(
      urls.scoreboardUrl,
      {
        homeQ1: ESPN_SCOREBOARD_SELECTORS.homeQ1,
        homeQ2: ESPN_SCOREBOARD_SELECTORS.homeQ2,
        awayQ1: ESPN_SCOREBOARD_SELECTORS.awayQ1,
        awayQ2: ESPN_SCOREBOARD_SELECTORS.awayQ2,
      },
      "scoreboard quarters",
    );
  }
}

/** @deprecated Use `preflightEspnBeforeRegister` or `assertEspnSettlementSelectorsResolvable`. */
export const assertEspnSelectorsResolvable = assertEspnSettlementSelectorsResolvable;

export function defaultV2FinalizeDelaySec(_sportKey: ScriptSportKey): number {
  return 10_800;
}

export function v2KernelSportEnum(sportKey: ScriptSportKey): number {
  switch (sportKey) {
    case "soccer":
      return 0;
    case "basketball":
      return 1;
    case "american_football":
      return 2;
    case "baseball":
      return 3;
    default: {
      const _x: never = sportKey;
      return _x;
    }
  }
}

export function kickoffUnixFromIsoUtc(kickoffUtc: string): number {
  const ms = Date.parse(kickoffUtc);
  if (!Number.isFinite(ms)) return 0;
  return Math.floor(ms / 1000);
}

export type V2LegWeightsTuple = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export type V2LegKindsTuple = V2LegWeightsTuple;

export function v2MarketLegsForFixture(
  fixtureId: string,
  homeTeam: string,
  awayTeam: string,
  sportKey: ScriptSportKey,
): readonly PlayscriptV2Leg[] {
  return selectV2MarketLegs(fixtureId, homeTeam, awayTeam, sportKey);
}

export function v2DefaultLegWeights(legs: readonly PlayscriptV2Leg[]): V2LegWeightsTuple {
  if (legs.length !== V2_LEG_COUNT) {
    throw new Error(`Expected ${V2_LEG_COUNT} v2 legs`);
  }
  return legs.map((L) => L.chainWeight) as unknown as V2LegWeightsTuple;
}

export function v2DefaultLegKinds(legs: readonly PlayscriptV2Leg[]): V2LegKindsTuple {
  return v2LegKindsTuple(legs);
}
