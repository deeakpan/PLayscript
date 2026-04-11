import { SCRIPT_SLOTS } from "@/lib/script-slots";

/** Short UI label + resolved pick (grading rules). */
export type SlotActualRow = { label: string; actual: string };

const SLOT_LABELS = ["Winner", "Goals", "BTS", "Clean sheet", "Line"] as const;

/** Derive the five script-slot answers from final (or live) goals — same rules as on-chain grading. */
export function deriveSlotOutcomesFromScore(
  homeGoals: number,
  awayGoals: number,
): SlotActualRow[] {
  const winner =
    homeGoals > awayGoals ? "Home" : awayGoals > homeGoals ? "Away" : "Draw";

  const total = homeGoals + awayGoals;
  const totalGoals = total > 2 ? "Over 2.5" : "Under 2.5";

  const bts = homeGoals > 0 && awayGoals > 0 ? "Yes" : "No";

  const cleanSheet =
    awayGoals === 0 || homeGoals === 0 ? "Yes" : "No";

  const correctScore = `${homeGoals}–${awayGoals}`;

  const values = [winner, totalGoals, bts, cleanSheet, correctScore];
  return SCRIPT_SLOTS.map((s, i) => ({
    label: SLOT_LABELS[i] ?? s.title,
    actual: values[i] ?? "—",
  }));
}
