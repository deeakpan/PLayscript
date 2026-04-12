import type { ScriptSportKey } from "@/lib/fixtures-shared";
import { getScriptSlots } from "@/lib/script-slots";

const SPORT_INDEX_TO_KEY: readonly ScriptSportKey[] = [
  "soccer",
  "basketball",
  "american_football",
  "baseball",
];

export function sportIndexToKey(sportIndex: number): ScriptSportKey {
  if (sportIndex >= 0 && sportIndex < SPORT_INDEX_TO_KEY.length) {
    return SPORT_INDEX_TO_KEY[sportIndex]!;
  }
  return "soccer";
}

function row(label: string, value: string): { label: string; value: string } {
  return { label, value };
}

function describeSoccer(slots: ReturnType<typeof getScriptSlots>, p: bigint): { label: string; value: string }[] {
  const w = Number(p & BigInt(3));
  const winner =
    w === 0 ? "Home" : w === 1 ? "Draw" : w === 2 ? "Away" : `Unknown (${w})`;
  const ou = (p >> BigInt(2)) & BigInt(1) ? "Over 2.5" : "Under 2.5";
  const bts = (p >> BigInt(3)) & BigInt(1) ? "Yes" : "No";
  const cs = (p >> BigInt(4)) & BigInt(1) ? "Yes" : "No";
  const ph = Number((p >> BigInt(8)) & BigInt(255));
  const pa = Number((p >> BigInt(16)) & BigInt(255));
  return [
    row(slots[0]!.title, winner),
    row(slots[1]!.title, ou),
    row(slots[2]!.title, bts),
    row(slots[3]!.title, cs),
    row(slots[4]!.title, `${ph}–${pa}`),
  ];
}

/** Non-soccer: contract uses home=0, away=1, tie=2 for bits 0–1. */
function describeNonSoccer(slots: ReturnType<typeof getScriptSlots>, p: bigint): { label: string; value: string }[] {
  const w = Number(p & BigInt(3));
  const winner =
    w === 0 ? "Home" : w === 1 ? "Away" : w === 2 ? "Tie" : `Unknown (${w})`;
  const ou = (p >> BigInt(2)) & BigInt(1) ? "Over" : "Under";
  const y = (bit: bigint) => (bit ? "Yes" : "No");
  const s3 = y((p >> BigInt(3)) & BigInt(1));
  const s4 = y((p >> BigInt(4)) & BigInt(1));
  const s5 = y((p >> BigInt(5)) & BigInt(1));
  return [
    row(slots[0]!.title, winner),
    row(slots[1]!.title, ou),
    row(slots[2]!.title, s3),
    row(slots[3]!.title, s4),
    row(slots[4]!.title, s5),
  ];
}

/** Human-readable rows for the script builder slots (aligned with on-chain `picksPacked`). */
export function describePackedPicks(
  sportIndex: number,
  picksPacked: bigint,
): { label: string; value: string }[] {
  const key = sportIndexToKey(sportIndex);
  const slots = getScriptSlots(key);
  if (sportIndex === 0) return describeSoccer(slots, picksPacked);
  return describeNonSoccer(slots, picksPacked);
}
