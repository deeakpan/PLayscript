import { getScriptSlots } from "@/lib/script-slots";

import { sportIndexToKey } from "@/lib/playscript-unpack-picks";

export type SlotGradeRow = {
  label: string;
  yourPick: string;
  result: string;
  correct: boolean;
};

function pickWinnerSoccer(w: number): string {
  return w === 0 ? "Home" : w === 1 ? "Draw" : "Away";
}

function pickWinnerNonSoccer(w: number): string {
  return w === 0 ? "Home" : w === 1 ? "Away" : "Tie";
}

function yn(b: boolean): string {
  return b ? "Yes" : "No";
}

/** Mirrors `PlayscriptCore._grade` + human-readable rows. */
export function gradePlayscriptSlots(
  sportIndex: number,
  picksPacked: bigint,
  h: bigint,
  a: bigint,
): { correctSlots: number; rows: SlotGradeRow[] } {
  const p = picksPacked;
  const w = Number(p & BigInt(3));
  const ou = Number((p >> BigInt(2)) & BigInt(1));
  const s3 = Number((p >> BigInt(3)) & BigInt(1));
  const s4 = Number((p >> BigInt(4)) & BigInt(1));
  const s5 = Number((p >> BigInt(5)) & BigInt(1));

  const hi = Number(h);
  const ai = Number(a);
  const slots = getScriptSlots(sportIndexToKey(sportIndex));
  const rows: SlotGradeRow[] = [];
  let ok = 0;

  if (sportIndex === 0) {
    const ph = Number((p >> BigInt(8)) & BigInt(255));
    const pa = Number((p >> BigInt(16)) & BigInt(255));
    let aw: number;
    if (h > a) aw = 0;
    else if (a > h) aw = 2;
    else aw = 1;
    const c0 = w === aw;
    if (c0) ok++;
    rows.push({
      label: slots[0]!.title,
      yourPick: pickWinnerSoccer(w),
      result: pickWinnerSoccer(aw),
      correct: c0,
    });

    const over = hi + ai > 2;
    const c1 = (over && ou === 1) || (!over && ou === 0);
    if (c1) ok++;
    rows.push({
      label: slots[1]!.title,
      yourPick: over ? "Over 2.5" : "Under 2.5",
      result: over ? "Over 2.5" : "Under 2.5",
      correct: c1,
    });

    const bts = hi > 0 && ai > 0;
    const c2 = (bts && s3 === 1) || (!bts && s3 === 0);
    if (c2) ok++;
    rows.push({
      label: slots[2]!.title,
      yourPick: yn(s3 === 1),
      result: yn(bts),
      correct: c2,
    });

    const cs = ai === 0 || hi === 0;
    const c3 = (cs && s4 === 1) || (!cs && s4 === 0);
    if (c3) ok++;
    rows.push({
      label: slots[3]!.title,
      yourPick: yn(s4 === 1),
      result: yn(cs),
      correct: c3,
    });

    const c4 = ph === hi && pa === ai;
    if (c4) ok++;
    rows.push({
      label: slots[4]!.title,
      yourPick: `${ph}–${pa}`,
      result: `${hi}–${ai}`,
      correct: c4,
    });
  } else if (sportIndex === 1) {
    let aw: number;
    if (h > a) aw = 0;
    else if (a > h) aw = 1;
    else aw = 2;
    const c0 = w === aw;
    if (c0) ok++;
    rows.push({
      label: slots[0]!.title,
      yourPick: pickWinnerNonSoccer(w),
      result: pickWinnerNonSoccer(aw),
      correct: c0,
    });

    const pts = hi + ai;
    const over = BigInt(2) * BigInt(pts) > BigInt(441);
    const c1 = (over && ou === 1) || (!over && ou === 0);
    if (c1) ok++;
    rows.push({
      label: slots[1]!.title,
      yourPick: ou === 1 ? "Over 220.5" : "Under 220.5",
      result: over ? "Over 220.5" : "Under 220.5",
      correct: c1,
    });

    const both100 = hi >= 100 && ai >= 100;
    const c2 = (both100 && s3 === 1) || (!both100 && s3 === 0);
    if (c2) ok++;
    rows.push({
      label: slots[2]!.title,
      yourPick: yn(s3 === 1),
      result: yn(both100),
      correct: c2,
    });

    const c230 = pts >= 230;
    const c3 = (c230 && s4 === 1) || (!c230 && s4 === 0);
    if (c3) ok++;
    rows.push({
      label: slots[3]!.title,
      yourPick: yn(s4 === 1),
      result: yn(c230),
      correct: c3,
    });

    const margin = hi > ai ? hi - ai : ai - hi;
    const blow = hi !== ai && margin >= 10;
    const c4 = (blow && s5 === 1) || (!blow && s5 === 0);
    if (c4) ok++;
    rows.push({
      label: slots[4]!.title,
      yourPick: yn(s5 === 1),
      result: yn(blow),
      correct: c4,
    });
  } else if (sportIndex === 2) {
    let aw: number;
    if (h > a) aw = 0;
    else if (a > h) aw = 1;
    else aw = 2;
    const c0 = w === aw;
    if (c0) ok++;
    rows.push({
      label: slots[0]!.title,
      yourPick: pickWinnerNonSoccer(w),
      result: pickWinnerNonSoccer(aw),
      correct: c0,
    });

    const pts = hi + ai;
    const over = BigInt(2) * BigInt(pts) > BigInt(87);
    const c1 = (over && ou === 1) || (!over && ou === 0);
    if (c1) ok++;
    rows.push({
      label: slots[1]!.title,
      yourPick: ou === 1 ? "Over 43.5" : "Under 43.5",
      result: over ? "Over 43.5" : "Under 43.5",
      correct: c1,
    });

    const both20 = hi >= 20 && ai >= 20;
    const c2 = (both20 && s3 === 1) || (!both20 && s3 === 0);
    if (c2) ok++;
    rows.push({
      label: slots[2]!.title,
      yourPick: yn(s3 === 1),
      result: yn(both20),
      correct: c2,
    });

    const c50 = pts >= 50;
    const c3 = (c50 && s4 === 1) || (!c50 && s4 === 0);
    if (c3) ok++;
    rows.push({
      label: slots[3]!.title,
      yourPick: yn(s4 === 1),
      result: yn(c50),
      correct: c3,
    });

    const margin = hi > ai ? hi - ai : ai - hi;
    const blow = hi !== ai && margin >= 10;
    const c4 = (blow && s5 === 1) || (!blow && s5 === 0);
    if (c4) ok++;
    rows.push({
      label: slots[4]!.title,
      yourPick: yn(s5 === 1),
      result: yn(blow),
      correct: c4,
    });
  } else {
    let aw: number;
    if (h > a) aw = 0;
    else if (a > h) aw = 1;
    else aw = 2;
    const c0 = w === aw;
    if (c0) ok++;
    rows.push({
      label: slots[0]!.title,
      yourPick: pickWinnerNonSoccer(w),
      result: pickWinnerNonSoccer(aw),
      correct: c0,
    });

    const runs = hi + ai;
    const over = BigInt(2) * BigInt(runs) > BigInt(17);
    const c1 = (over && ou === 1) || (!over && ou === 0);
    if (c1) ok++;
    rows.push({
      label: slots[1]!.title,
      yourPick: ou === 1 ? "Over 8.5" : "Under 8.5",
      result: over ? "Over 8.5" : "Under 8.5",
      correct: c1,
    });

    const both3 = hi >= 3 && ai >= 3;
    const c2 = (both3 && s3 === 1) || (!both3 && s3 === 0);
    if (c2) ok++;
    rows.push({
      label: slots[2]!.title,
      yourPick: yn(s3 === 1),
      result: yn(both3),
      correct: c2,
    });

    const c10 = runs >= 10;
    const c3 = (c10 && s4 === 1) || (!c10 && s4 === 0);
    if (c3) ok++;
    rows.push({
      label: slots[3]!.title,
      yourPick: yn(s4 === 1),
      result: yn(c10),
      correct: c3,
    });

    const margin = hi > ai ? hi - ai : ai - hi;
    const m3 = hi !== ai && margin >= 3;
    const c4 = (m3 && s5 === 1) || (!m3 && s5 === 0);
    if (c4) ok++;
    rows.push({
      label: slots[4]!.title,
      yourPick: yn(s5 === 1),
      result: yn(m3),
      correct: c4,
    });
  }

  return { correctSlots: ok, rows };
}

/** Payout mints from `claimPayout` when `correctSlots >= 3` (same bps as contract). */
export function claimPayoutPreview(correctSlots: number, stakeWei: bigint): {
  winner: boolean;
  multBps: number;
  tierLabel: string;
  mintUserWei: bigint;
  mintFeeWei: bigint;
} {
  if (correctSlots < 3) {
    return {
      winner: false,
      multBps: 0,
      tierLabel: "Below 3/5 — no PLAY mint",
      mintUserWei: BigInt(0),
      mintFeeWei: BigInt(0),
    };
  }
  const multBps = correctSlots >= 5 ? 30 : correctSlots === 4 ? 18 : 12;
  const tierLabel =
    correctSlots >= 5 ? "5/5 — 3×" : correctSlots === 4 ? "4/5 — 1.8×" : "3/5 — 1.2×";
  const payout = (stakeWei * BigInt(multBps)) / BigInt(10);
  const mintFeeWei = (payout * BigInt(5)) / BigInt(100);
  const mintUserWei = payout - mintFeeWei;
  return { winner: true, multBps, tierLabel, mintUserWei, mintFeeWei };
}
