/**
 * Fixed 12-leg market for ESPN 740902 (Man City 3–0 Crystal Palace) integration tests.
 * Slots 0–4 are chosen so a 5/5 lock can win; slots 5–11 include decoys.
 */
import { V2_SOCCER_LEG_KINDS as K } from "./playscript-v2-leg-kinds";
import type { PlayscriptV2Leg } from "./playscript-v2-legs";
import { V2_LEG_COUNT, legIdsToBitmask } from "./playscript-v2-legs";

/** On-chain `legKinds[0..11]` for registerMatch. */
export const INTEGRATION_740902_LEG_KINDS: readonly [
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
] = [
  K.HOME_WIN,
  K.OVER_25,
  K.HOME_CS,
  K.HOME_LEAD_HT,
  K.MATCH_YELLOW_2PLUS,
  K.BTTS,
  K.DRAW,
  K.AWAY_WIN,
  K.AWAY_CS,
  K.UNDER_15,
  K.AWAY_LEAD_HT,
  K.DRAW_HT,
];

/** ESPN 740902 settled facts (same as on-chain after Somnia JSON fetch). */
export const INTEGRATION_740902_FACTS = {
  finalHome: 3,
  finalAway: 0,
  htHome: 2,
  htAway: 0,
  yellowHome: 0,
  yellowAway: 2,
  redHome: 0,
  redAway: 0,
} satisfies {
  finalHome: number;
  finalAway: number;
  htHome: number;
  htAway: number;
  yellowHome: number;
  yellowAway: number;
  redHome: number;
  redAway: number;
};

export function gradeSoccerKind(kind: number): boolean {
  const f = INTEGRATION_740902_FACTS;
  const h = f.finalHome;
  const a = f.finalAway;
  const ht = f.htHome + f.htAway;
  const yc = f.yellowHome + f.yellowAway;
  switch (kind) {
    case K.HOME_WIN:
      return h > a;
    case K.AWAY_WIN:
      return a > h;
    case K.DRAW:
      return h === a;
    case K.OVER_25:
      return h + a >= 3;
    case K.UNDER_15:
      return h + a <= 1;
    case K.BTTS:
      return h >= 1 && a >= 1;
    case K.HOME_CS:
      return a === 0;
    case K.AWAY_CS:
      return h === 0;
    case K.HOME_LEAD_HT:
      return f.htHome > f.htAway;
    case K.AWAY_LEAD_HT:
      return f.htAway > f.htHome;
    case K.DRAW_HT:
      return f.htHome === f.htAway;
    case K.MATCH_YELLOW_2PLUS:
      return yc >= 2;
    case K.HOME_YELLOW_2PLUS:
      return f.yellowHome >= 2;
    default:
      return false;
  }
}

export function integrationResolvedBitmask(): number {
  let mask = 0;
  for (let i = 0; i < V2_LEG_COUNT; i++) {
    if (gradeSoccerKind(INTEGRATION_740902_LEG_KINDS[i]!)) mask |= 1 << i;
  }
  return mask;
}

/** Chain weights aligned with easy/medium/hard for each kind slot. */
export const INTEGRATION_740902_LEG_WEIGHTS: readonly [
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
] = [10, 10, 15, 15, 15, 15, 25, 10, 15, 25, 15, 25];

export type IntegrationScriptPlan = {
  label: string;
  expectWin: boolean;
  legIds: readonly number[];
  playAmountHuman: string;
};

/**
 * Losers first with modest stakes so all three fit in ~542 PLAY `matchLiabilityCap`.
 * `playAmountHuman` is sent to `lockScript`; may partial-fill when room is tight.
 */
export const INTEGRATION_LOCK_PLANS: readonly IntegrationScriptPlan[] = [
  {
    label: "loser-btts-miss",
    expectWin: false,
    legIds: [1, 2, 3, 4, 6],
    playAmountHuman: "55",
  },
  {
    label: "loser-away-win-miss",
    expectWin: false,
    legIds: [1, 2, 3, 4, 9],
    playAmountHuman: "55",
  },
  {
    label: "winner-5of5",
    expectWin: true,
    legIds: [1, 2, 3, 4, 5],
    playAmountHuman: "500",
  },
];

export function planToLegMask12(plan: IntegrationScriptPlan): number {
  const mask = legIdsToBitmask(plan.legIds);
  if (plan.legIds.length !== 5) throw new Error(`${plan.label}: need 5 leg ids`);
  return mask;
}

export function describeIntegrationLegs(home: string, away: string): PlayscriptV2Leg[] {
  const labels: Record<number, string> = {
    [K.HOME_WIN]: `${home} wins`,
    [K.OVER_25]: "Over 2.5 total goals",
    [K.HOME_CS]: `${home} clean sheet`,
    [K.HOME_LEAD_HT]: `${home} leads at half-time`,
    [K.MATCH_YELLOW_2PLUS]: "2+ yellow cards in the match (combined)",
    [K.BTTS]: "Both teams score",
    [K.DRAW]: "Draw",
    [K.AWAY_WIN]: `${away} wins`,
    [K.AWAY_CS]: `${away} clean sheet`,
    [K.UNDER_15]: "Under 1.5 total goals",
    [K.AWAY_LEAD_HT]: `${away} leads at half-time`,
    [K.DRAW_HT]: "Draw at half-time",
  };
  return INTEGRATION_740902_LEG_KINDS.map((kind, i) => ({
    id: i + 1,
    kind,
    description: labels[kind] ?? `kind ${kind}`,
    type: "integration",
    difficulty: "medium" as const,
    weight: 1.5,
    chainWeight: INTEGRATION_740902_LEG_WEIGHTS[i]! as 10 | 15 | 25,
  }));
}
