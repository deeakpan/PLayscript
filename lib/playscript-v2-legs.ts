import type { ScriptSportKey } from "./fixtures-shared";
import {
  evaluateV2LegPickLive,
  type V2GradingFacts,
} from "./playscript-v2-grading";
import {
  V2_BASKETBALL_MARKET_LEG_KINDS,
  V2_BASKETBALL_LEG_KINDS as BK,
  V2_MLB_MARKET_LEG_KINDS,
  V2_MLB_LEG_KINDS as MLB,
  V2_NFL_MARKET_LEG_KINDS,
  V2_NFL_LEG_KINDS as NFL,
  V2_SOCCER_MARKET_LEG_KINDS,
  V2_SOCCER_LEG_KINDS as SC,
} from "./playscript-v2-leg-kinds";

export { V2_SOCCER_MARKET_LEG_KINDS };

/** Must match `PlayscriptKernel` + UI picker (`LegBitmask.MARKET_BITS`). */
export const V2_LEG_COUNT = 15;
export const V2_PICK_COUNT = 5;
export const V2_MASK_MAX = (1 << V2_LEG_COUNT) - 1;

export type PlayscriptV2Difficulty = "easy" | "medium" | "hard";

export type PlayscriptV2Leg = {
  /** 1…12; bit index is `id - 1`. */
  id: number;
  /** On-chain grading kind — see `playscript-v2-leg-kinds.ts`. */
  kind: number;
  description: string;
  type: string;
  difficulty: PlayscriptV2Difficulty;
  weight: number;
  chainWeight: 10 | 15 | 25;
};

const W = {
  easy: { weight: 1.0, chain: 10 as const },
  medium: { weight: 1.5, chain: 15 as const },
  hard: { weight: 2.5, chain: 25 as const },
};

type LegDef = Omit<PlayscriptV2Leg, "id">;

function def(
  kind: number,
  description: string,
  type: string,
  difficulty: PlayscriptV2Difficulty,
): LegDef {
  const d = W[difficulty];
  return { kind, description, type, difficulty, weight: d.weight, chainWeight: d.chain };
}

function defsForSport(home: string, away: string, sportKey: ScriptSportKey): LegDef[] {
  switch (sportKey) {
    case "soccer":
      return [
        def(SC.HOME_WIN, `${home} wins`, "match_result", "easy"),
        def(SC.AWAY_WIN, `${away} wins`, "match_result", "easy"),
        def(SC.DRAW, "Draw", "match_result", "hard"),
        def(SC.OVER_25, "Over 2.5 total goals", "goals", "easy"),
        def(SC.UNDER_15, "Under 1.5 total goals", "goals", "hard"),
        def(SC.UNDER_25, "Under 2.5 total goals", "goals", "medium"),
        def(SC.BTTS, "Both teams score", "goals", "medium"),
        def(SC.HOME_CS, `${home} clean sheet`, "defence", "medium"),
        def(SC.AWAY_CS, `${away} clean sheet`, "defence", "medium"),
        def(SC.HOME_WIN_2PLUS, `${home} wins by 2+ goals`, "margin", "medium"),
        def(SC.AWAY_WIN_2PLUS, `${away} wins by 2+ goals`, "margin", "medium"),
        def(SC.FH_ANY_GOAL, "At least one goal in the first half", "timing", "easy"),
        def(SC.BOTH_UNDER_3, "Each team scores fewer than 3 goals", "goals", "medium"),
        def(SC.HOME_LEAD_HT, `${home} leads at half-time`, "half_time", "medium"),
        def(SC.AWAY_LEAD_HT, `${away} leads at half-time`, "half_time", "medium"),
        def(SC.DRAW_HT, "Draw at half-time", "half_time", "hard"),
        def(SC.HOME_HT_OVER_05, `${home} scores in the first half`, "half_time", "easy"),
        def(SC.AWAY_HT_OVER_05, `${away} scores in the first half`, "half_time", "easy"),
        def(SC.MATCH_YELLOW_2PLUS, "2+ yellow cards in the match (combined)", "cards", "medium"),
        def(SC.HOME_YELLOW_1PLUS, `${home} receives a yellow card`, "cards", "easy"),
        def(SC.AWAY_YELLOW_1PLUS, `${away} receives a yellow card`, "cards", "easy"),
        def(SC.HOME_YELLOW_2PLUS, `${home} receives 2+ yellow cards`, "cards", "medium"),
        def(SC.AWAY_YELLOW_2PLUS, `${away} receives 2+ yellow cards`, "cards", "medium"),
        def(SC.BOTH_TEAMS_YELLOW, "Both teams receive a yellow card", "cards", "medium"),
        def(SC.SH_OVER_15, "Over 1.5 goals in the second half", "half_time", "medium"),
        def(SC.SH_BTTS, "Both teams score in the second half", "goals", "medium"),
        def(SC.HOME_RED_CARD, `${home} receives a red card`, "cards", "hard"),
        def(SC.AWAY_RED_CARD, `${away} receives a red card`, "cards", "hard"),
        def(SC.HT_OVER_15, "Over 1.5 goals in the first half", "half_time", "medium"),
        def(SC.HT_UNDER_05, "Under 0.5 goals in the first half", "half_time", "hard"),
        def(SC.HOME_HT_CS, `${home} clean sheet at half-time`, "half_time", "medium"),
        def(SC.AWAY_HT_CS, `${away} clean sheet at half-time`, "half_time", "medium"),
        def(SC.HOME_SCORES_2PLUS, `${home} scores 2+ goals`, "goals", "medium"),
        def(SC.AWAY_SCORES_2PLUS, `${away} scores 2+ goals`, "goals", "medium"),
      ];
    case "basketball":
      return [
        def(BK.HOME_WIN, `${home} wins`, "match_result", "easy"),
        def(BK.AWAY_WIN, `${away} wins`, "match_result", "easy"),
        def(BK.OVER_225, "Over 225.5 total points", "totals", "easy"),
        def(BK.UNDER_200, "Under 200.5 total points", "totals", "hard"),
        def(BK.BOTH_100_PLUS, "Both teams score 100+ points", "totals", "medium"),
        def(BK.BOTH_UNDER_120, "Neither team reaches 120 points", "totals", "medium"),
        def(BK.HOME_WIN_10PLUS, `${home} wins by 10+ points`, "margin", "medium"),
        def(BK.AWAY_WIN_10PLUS, `${away} wins by 10+ points`, "margin", "medium"),
        def(BK.FIRST_HALF_OVER_115, "First half over 115.5 combined points", "timing", "easy"),
        def(BK.TOTAL_230_PLUS, "Combined score 230 or higher", "totals", "medium"),
        def(BK.MARGIN_20_PLUS, "Margin of 20+ points (either team)", "margin", "hard"),
        def(BK.BOTH_UNDER_110, "Both teams under 110 points", "totals", "hard"),
        def(BK.Q1_COMBINED_OVER_55, "1st quarter over 55.5 combined points", "quarters", "medium"),
        def(BK.HOME_Q1_OVER_28, `${home} scores 28+ in the 1st quarter`, "quarters", "hard"),
        def(BK.AWAY_Q1_OVER_28, `${away} scores 28+ in the 1st quarter`, "quarters", "hard"),
      ];
    case "american_football":
      return [
        def(NFL.HOME_WIN, `${home} wins`, "match_result", "easy"),
        def(NFL.AWAY_WIN, `${away} wins`, "match_result", "easy"),
        def(NFL.OVER_45, "Over 45.5 total points", "totals", "easy"),
        def(NFL.UNDER_38, "Under 38.5 total points", "totals", "hard"),
        def(NFL.BOTH_17_PLUS, "Both teams score 17+ points", "totals", "medium"),
        def(NFL.HOME_ALLOWS_10, `${home} allows 10 or fewer points`, "defence", "medium"),
        def(NFL.AWAY_ALLOWS_10, `${away} allows 10 or fewer points`, "defence", "medium"),
        def(NFL.MARGIN_10_PLUS, "Winning margin of 10+ points", "margin", "medium"),
        def(NFL.FIRST_HALF_OVER_23, "First half over 23.5 combined points", "timing", "easy"),
        def(NFL.BOTH_24_PLUS, "Both teams score 24+ points", "totals", "medium"),
        def(NFL.TOTAL_55_PLUS, "Combined score 55+", "totals", "hard"),
        def(NFL.EITHER_SHUTOUT, "Either team shutout (0 points)", "defence", "hard"),
        def(NFL.Q1_COMBINED_OVER_14, "1st quarter over 14.5 combined points", "quarters", "medium"),
        def(NFL.HOME_20_PLUS, `${home} scores 20+ points`, "offence", "medium"),
        def(NFL.AWAY_20_PLUS, `${away} scores 20+ points`, "offence", "medium"),
      ];
    case "baseball":
      return [
        def(MLB.HOME_WIN, `${home} wins`, "match_result", "easy"),
        def(MLB.AWAY_WIN, `${away} wins`, "match_result", "easy"),
        def(MLB.OVER_9_5, "Over 9.5 total runs", "totals", "easy"),
        def(MLB.UNDER_7_5, "Under 7.5 total runs", "totals", "hard"),
        def(MLB.BOTH_4_PLUS, "Both teams score 4+ runs", "offence", "medium"),
        def(MLB.HOME_5_PLUS, `${home} scores 5+ runs`, "offence", "medium"),
        def(MLB.AWAY_5_PLUS, `${away} scores 5+ runs`, "offence", "medium"),
        def(MLB.TOTAL_10_PLUS, "10+ total runs scored", "totals", "medium"),
        def(MLB.MARGIN_3_PLUS, "Winning margin of 3+ runs", "margin", "medium"),
        def(MLB.BOTH_SCORE, "Both teams score at least once", "offence", "easy"),
        def(MLB.EITHER_SHUTOUT, "Either team shutout (0 runs)", "defence", "hard"),
        def(MLB.BOTH_UNDER_7, "Each team scores fewer than 7 runs", "totals", "medium"),
        def(MLB.OVER_8_5, "Over 8.5 total runs", "totals", "easy"),
        def(MLB.HOME_3_PLUS, `${home} scores 3+ runs`, "offence", "medium"),
        def(MLB.AWAY_3_PLUS, `${away} scores 3+ runs`, "offence", "medium"),
      ];
  }
}

function marketKindOrder(sportKey: ScriptSportKey): readonly number[] {
  switch (sportKey) {
    case "soccer":
      return V2_SOCCER_MARKET_LEG_KINDS;
    case "basketball":
      return V2_BASKETBALL_MARKET_LEG_KINDS;
    case "american_football":
      return V2_NFL_MARKET_LEG_KINDS;
    case "baseball":
      return V2_MLB_MARKET_LEG_KINDS;
    default: {
      const _x: never = sportKey;
      return _x;
    }
  }
}

/** Build the canonical 12-leg market (paired outcomes, same for every fixture of that sport). */
function buildStructuredMarketLegs(
  homeTeam: string,
  awayTeam: string,
  sportKey: ScriptSportKey,
): readonly PlayscriptV2Leg[] {
  const h = homeTeam.trim() || "Home";
  const a = awayTeam.trim() || "Away";
  const pool = defsForSport(h, a, sportKey);
  const byKind = new Map(pool.map((d) => [d.kind, d]));
  const order = marketKindOrder(sportKey);

  if (order.length !== V2_LEG_COUNT) {
    throw new Error(`${sportKey} market kind list must have ${V2_LEG_COUNT} entries, got ${order.length}`);
  }

  const chosen: LegDef[] = [];
  for (const kind of order) {
    const leg = byKind.get(kind);
    if (!leg) throw new Error(`Missing ${sportKey} leg kind ${kind} in defsForSport`);
    chosen.push(leg);
  }

  return chosen.map((legDef, i) => ({
    ...legDef,
    id: i + 1,
  }));
}

/**
 * Deterministic 12-leg market per sport: paired results, totals, and team mirrors —
 * not a random subset of a larger pool.
 */
export function selectV2MarketLegs(
  _fixtureId: string,
  homeTeam: string,
  awayTeam: string,
  sportKey: ScriptSportKey,
): readonly PlayscriptV2Leg[] {
  return buildStructuredMarketLegs(homeTeam, awayTeam, sportKey);
}

/** Build the 12 slot labels from on-chain `legKinds` (bit `i` ↔ slot `i + 1`). */
export function v2LegsFromRegisteredKinds(
  homeTeam: string,
  awayTeam: string,
  sportKey: ScriptSportKey,
  legKinds: readonly number[],
): readonly PlayscriptV2Leg[] {
  if (legKinds.length !== V2_LEG_COUNT) {
    throw new Error(`Expected ${V2_LEG_COUNT} leg kinds, got ${legKinds.length}`);
  }
  const h = homeTeam.trim() || "Home";
  const a = awayTeam.trim() || "Away";
  const pool = defsForSport(h, a, sportKey);
  const byKind = new Map(pool.map((d) => [d.kind, d]));
  return legKinds.map((kind, i) => {
    const leg = byKind.get(kind);
    return {
      id: i + 1,
      kind,
      description: leg?.description ?? `Leg kind ${kind}`,
      type: leg?.type ?? "unknown",
      difficulty: leg?.difficulty ?? "medium",
      weight: leg?.weight ?? 1.5,
      chainWeight: leg?.chainWeight ?? 15,
    };
  });
}

/** True when this match was registered with a different 12-leg board than today's template. */
export function v2RegisteredLegKindsDifferFromCurrentMarket(
  sportKey: ScriptSportKey,
  registeredLegKinds: readonly number[],
): boolean {
  if (registeredLegKinds.length !== V2_LEG_COUNT) return false;
  const current = marketKindOrder(sportKey);
  return registeredLegKinds.some((k, i) => k !== current[i]);
}

function v2MarketLegsForGrading(
  fixtureId: string,
  homeTeam: string,
  awayTeam: string,
  sportKey: ScriptSportKey,
  registeredLegKinds?: readonly number[],
): readonly PlayscriptV2Leg[] {
  if (registeredLegKinds?.length === V2_LEG_COUNT) {
    return v2LegsFromRegisteredKinds(homeTeam, awayTeam, sportKey, registeredLegKinds);
  }
  return selectV2MarketLegs(fixtureId, homeTeam, awayTeam, sportKey);
}

/** @deprecated Use `selectV2MarketLegs(fixtureId, …)`. */
export function generateV2MarketLegs(
  homeTeam: string,
  awayTeam: string,
  sportKey: ScriptSportKey,
): readonly PlayscriptV2Leg[] {
  return selectV2MarketLegs("legacy", homeTeam, awayTeam, sportKey);
}

export const generateEightLegs = generateV2MarketLegs;

export type V2LegKindsTuple = readonly [
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
  number,
  number,
  number,
];

export function v2LegKindsTuple(legs: readonly PlayscriptV2Leg[]): V2LegKindsTuple {
  if (legs.length !== V2_LEG_COUNT) {
    throw new Error(`Expected ${V2_LEG_COUNT} legs`);
  }
  return legs.map((L) => L.kind) as unknown as V2LegKindsTuple;
}

export function difficultyLabel(d: PlayscriptV2Difficulty): string {
  switch (d) {
    case "easy":
      return "Easy";
    case "medium":
      return "Medium";
    case "hard":
      return "Hard";
    default: {
      const _e: never = d;
      return _e;
    }
  }
}

export function sumSelectedWeights(legs: readonly PlayscriptV2Leg[], bitmask: number): number {
  let s = 0;
  for (const L of legs) {
    const bit = 1 << (L.id - 1);
    if ((bitmask & bit) !== 0) s += L.weight;
  }
  return Math.round(s * 10) / 10;
}

export function legIdsToBitmask(ids: readonly number[]): number {
  let m = 0;
  for (const id of ids) {
    if (!Number.isInteger(id) || id < 1 || id > V2_LEG_COUNT) continue;
    m |= 1 << (id - 1);
  }
  return m & V2_MASK_MAX;
}

export function bitmaskPopcount(mask: number): number {
  let c = 0;
  for (let i = 0; i < V2_LEG_COUNT; i++) {
    if ((mask >> i) & 1) c++;
  }
  return c;
}

export function bitmaskToSortedLegIds(mask: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < V2_LEG_COUNT; i++) {
    if ((mask >> i) & 1) out.push(i + 1);
  }
  return out;
}

export type V2LegPickDescription = {
  legId: number;
  description: string;
  difficulty: PlayscriptV2Difficulty;
};

/** Decode a locked `legMask12` into human-readable picks (same 12-leg market as the fixture UI). */
export function describeV2LegMaskPicks(
  fixtureId: string,
  homeTeam: string,
  awayTeam: string,
  sportKey: ScriptSportKey,
  legMask12: number,
  registeredLegKinds?: readonly number[],
): readonly V2LegPickDescription[] {
  const mask = legMask12 & V2_MASK_MAX;
  const market = v2MarketLegsForGrading(
    fixtureId,
    homeTeam,
    awayTeam,
    sportKey,
    registeredLegKinds,
  );
  const byId = new Map(market.map((l) => [l.id, l]));
  return bitmaskToSortedLegIds(mask).map((legId) => {
    const leg = byId.get(legId);
    return {
      legId,
      description: leg?.description ?? `Leg ${legId}`,
      difficulty: leg?.difficulty ?? "medium",
    };
  });
}

/** Single-line summary for cards (e.g. My Scripts). */
export function formatV2LegMaskPlainText(
  fixtureId: string,
  homeTeam: string,
  awayTeam: string,
  sportKey: ScriptSportKey,
  legMask12: number,
  registeredLegKinds?: readonly number[],
): string {
  const picks = describeV2LegMaskPicks(
    fixtureId,
    homeTeam,
    awayTeam,
    sportKey,
    legMask12,
    registeredLegKinds,
  );
  if (picks.length === 0) return "No picks decoded";
  return picks.map((p) => p.description).join(" · ");
}

export type V2GradedPick = V2LegPickDescription & {
  /** `null` until the match is settled onchain. */
  correct: boolean | null;
};

export type V2LiveGradeContext = {
  sport: number;
  facts: V2GradingFacts;
  /** ESPN / display status: full-time — grade all legs from scoreline. */
  matchEnded: boolean;
};

/** Grade each selected leg against `resolvedLegsBitmask` (bit index = leg id − 1). */
export function gradeV2LegMaskPicks(
  fixtureId: string,
  homeTeam: string,
  awayTeam: string,
  sportKey: ScriptSportKey,
  legMask12: number,
  resolvedLegsBitmask: number,
  settled: boolean,
  registeredLegKinds?: readonly number[],
  live?: V2LiveGradeContext,
): { picks: readonly V2GradedPick[]; correctCount: number; totalPicks: number } {
  const market = v2MarketLegsForGrading(
    fixtureId,
    homeTeam,
    awayTeam,
    sportKey,
    registeredLegKinds,
  );
  const kindByLegId = new Map(market.map((l) => [l.id, l.kind]));
  const picks = describeV2LegMaskPicks(
    fixtureId,
    homeTeam,
    awayTeam,
    sportKey,
    legMask12,
    registeredLegKinds,
  );
  const resolved = resolvedLegsBitmask & V2_MASK_MAX;
  let correctCount = 0;
  const graded: V2GradedPick[] = picks.map((p) => {
    if (settled) {
      const bit = 1 << (p.legId - 1);
      const correct = (resolved & bit) !== 0;
      if (correct) correctCount++;
      return { ...p, correct };
    }
    if (live) {
      const kind = kindByLegId.get(p.legId);
      if (kind === undefined) return { ...p, correct: null };
      const correct = evaluateV2LegPickLive(live.sport, kind, live.facts, live.matchEnded);
      if (correct === true) correctCount++;
      return { ...p, correct };
    }
    return { ...p, correct: null };
  });
  return { picks: graded, correctCount, totalPicks: picks.length };
}

/** All 15-bit masks with exactly `V2_PICK_COUNT` bits set (C(15,5) = 3003). */
export function allV2FivePickMasks(): readonly number[] {
  const out: number[] = [];
  for (let mask = 0; mask <= V2_MASK_MAX; mask++) {
    if (bitmaskPopcount(mask) === V2_PICK_COUNT) out.push(mask);
  }
  return out;
}
