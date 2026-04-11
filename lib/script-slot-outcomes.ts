import type { ScriptSportKey } from "@/lib/fixtures-shared";
import { getScriptSlots } from "@/lib/script-slots";

/** Short UI label + resolved pick (grading rules). */
export type SlotActualRow = { label: string; actual: string };

const SOCCER_LABELS = ["Winner", "Goals", "BTS", "Clean sheet", "Line"] as const;

const BASKETBALL_LABELS = ["Winner", "O/U 220.5", "100+", "230+", "10+ pt"] as const;

const NFL_LABELS = ["Result", "O/U 43.5", "20+", "50+", "10+ pt"] as const;

const MLB_LABELS = ["Winner", "O/U 8.5", "3+ each", "10+ runs", "3+ margin"] as const;

function soccerOutcomes(homeGoals: number, awayGoals: number): string[] {
  const winner =
    homeGoals > awayGoals ? "Home" : awayGoals > homeGoals ? "Away" : "Draw";
  const total = homeGoals + awayGoals;
  const totalGoals = total > 2 ? "Over 2.5" : "Under 2.5";
  const bts = homeGoals > 0 && awayGoals > 0 ? "Yes" : "No";
  const cleanSheet = awayGoals === 0 || homeGoals === 0 ? "Yes" : "No";
  const correctScore = `${homeGoals}–${awayGoals}`;
  return [winner, totalGoals, bts, cleanSheet, correctScore];
}

function basketballOutcomes(h: number, a: number): string[] {
  const winner = h > a ? "Home" : a > h ? "Away" : "Tie";
  const pts = h + a;
  const ou = pts > 220.5 ? "Over 220.5" : "Under 220.5";
  const both100 = h >= 100 && a >= 100 ? "Yes" : "No";
  const c230 = pts >= 230 ? "Yes" : "No";
  const margin = Math.abs(h - a);
  const blowout =
    h === a ? "No" : margin >= 10 ? "Yes" : "No";
  return [winner, ou, both100, c230, blowout];
}

function americanFootballOutcomes(h: number, a: number): string[] {
  const result = h > a ? "Home" : a > h ? "Away" : "Tie";
  const pts = h + a;
  const ou = pts > 43.5 ? "Over 43.5" : "Under 43.5";
  const both20 = h >= 20 && a >= 20 ? "Yes" : "No";
  const c50 = pts >= 50 ? "Yes" : "No";
  const margin = Math.abs(h - a);
  const blowout = h === a ? "No" : margin >= 10 ? "Yes" : "No";
  return [result, ou, both20, c50, blowout];
}

function baseballOutcomes(h: number, a: number): string[] {
  const winner = h > a ? "Home" : a > h ? "Away" : "Tie";
  const runs = h + a;
  const ou = runs > 8.5 ? "Over 8.5" : "Under 8.5";
  const both3 = h >= 3 && a >= 3 ? "Yes" : "No";
  const c10 = runs >= 10 ? "Yes" : "No";
  const margin3 = h === a ? "No" : Math.abs(h - a) >= 3 ? "Yes" : "No";
  return [winner, ou, both3, c10, margin3];
}

/** Derive five script-slot answers from final (or live) scores — rules match the active sport pack. */
export function deriveSlotOutcomesFromScore(
  homeScore: number,
  awayScore: number,
  sport: ScriptSportKey,
): SlotActualRow[] {
  const slots = getScriptSlots(sport);
  let values: string[];
  let labels: readonly string[];

  switch (sport) {
    case "basketball":
      values = basketballOutcomes(homeScore, awayScore);
      labels = BASKETBALL_LABELS;
      break;
    case "american_football":
      values = americanFootballOutcomes(homeScore, awayScore);
      labels = NFL_LABELS;
      break;
    case "baseball":
      values = baseballOutcomes(homeScore, awayScore);
      labels = MLB_LABELS;
      break;
    default:
      values = soccerOutcomes(homeScore, awayScore);
      labels = SOCCER_LABELS;
      break;
  }

  return slots.map((s, i) => ({
    label: labels[i] ?? s.title,
    actual: values[i] ?? "—",
  }));
}
