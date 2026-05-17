import type { ScriptSportKey } from "./fixtures-shared";
import {
  V2_BASKETBALL_LEG_KINDS as BK,
  V2_MLB_LEG_KINDS as MLB,
  V2_NFL_LEG_KINDS as NFL,
  V2_SOCCER_CORE_LEG_KINDS,
  V2_SOCCER_LEG_KINDS as SC,
} from "./playscript-v2-leg-kinds";

/** Must match `PlayscriptKernel` + UI picker. */
export const V2_LEG_COUNT = 12;
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
      ];
  }
}

function fnv1a32(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_SOCCER_CARD_LEGS_IN_MARKET = 2;

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function selectSoccerMarketLegs(
  fixtureId: string,
  homeTeam: string,
  awayTeam: string,
): readonly PlayscriptV2Leg[] {
  const pool = defsForSport(homeTeam, awayTeam, "soccer");
  const byKind = new Map(pool.map((d) => [d.kind, d]));
  const rng = mulberry32(fnv1a32(`soccer:${fixtureId.trim()}`));

  const chosen: LegDef[] = [];
  const usedKinds = new Set<number>();

  for (const kind of V2_SOCCER_CORE_LEG_KINDS) {
    const leg = byKind.get(kind);
    if (!leg) throw new Error(`Missing core soccer leg kind ${kind}`);
    chosen.push(leg);
    usedKinds.add(kind);
  }

  const optional = pool.filter((d) => !usedKinds.has(d.kind));
  shuffleInPlace(optional, rng);

  let cardLegs = 0;
  for (const leg of optional) {
    if (chosen.length >= V2_LEG_COUNT) break;
    if (leg.type === "cards") {
      if (cardLegs >= MAX_SOCCER_CARD_LEGS_IN_MARKET) continue;
      cardLegs++;
    }
    chosen.push(leg);
    usedKinds.add(leg.kind);
  }

  if (chosen.length < V2_LEG_COUNT) {
    throw new Error(`Soccer leg pool too small: need ${V2_LEG_COUNT}, got ${chosen.length}`);
  }

  shuffleInPlace(chosen, rng);

  return chosen.map((def, i) => ({
    ...def,
    id: i + 1,
  }));
}

/** Deterministic pick — 12 unique leg kinds per fixture (soccer: core results + HT, then varied fill). */
export function selectV2MarketLegs(
  fixtureId: string,
  homeTeam: string,
  awayTeam: string,
  sportKey: ScriptSportKey,
): readonly PlayscriptV2Leg[] {
  if (sportKey === "soccer") {
    return selectSoccerMarketLegs(fixtureId, homeTeam, awayTeam);
  }

  const h = homeTeam.trim() || "Home";
  const a = awayTeam.trim() || "Away";
  const pool = defsForSport(h, a, sportKey);
  const rng = mulberry32(fnv1a32(`${sportKey}:${fixtureId.trim()}`));
  const indices = pool.map((_, i) => i);
  shuffleInPlace(indices, rng);

  const chosen: LegDef[] = [];
  const usedKinds = new Set<number>();
  for (const idx of indices) {
    const leg = pool[idx]!;
    if (usedKinds.has(leg.kind)) continue;
    usedKinds.add(leg.kind);
    chosen.push(leg);
    if (chosen.length === V2_LEG_COUNT) break;
  }
  if (chosen.length < V2_LEG_COUNT) {
    throw new Error(`Leg pool too small for ${sportKey}: need ${V2_LEG_COUNT}, got ${chosen.length}`);
  }

  return chosen.map((def, i) => ({
    ...def,
    id: i + 1,
  }));
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

export function v2LegKindsTuple(legs: readonly PlayscriptV2Leg[]): [
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
] {
  if (legs.length !== V2_LEG_COUNT) {
    throw new Error(`Expected ${V2_LEG_COUNT} legs`);
  }
  return legs.map((L) => L.kind) as [
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
): readonly V2LegPickDescription[] {
  const mask = legMask12 & V2_MASK_MAX;
  const market = selectV2MarketLegs(fixtureId, homeTeam, awayTeam, sportKey);
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
): string {
  const picks = describeV2LegMaskPicks(fixtureId, homeTeam, awayTeam, sportKey, legMask12);
  if (picks.length === 0) return "No picks decoded";
  return picks.map((p) => p.description).join(" · ");
}
