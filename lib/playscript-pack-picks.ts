/** `picksPacked` layout must match `PlayscriptCore._validatePicks` / `_grade`. */

/** Soccer: bits 0–1 winner (0 home 1 draw 2 away), 2 O/U, 3 BTS, 4 CS, 8–15 home goals, 16–23 away. */
export function packSoccerPicks(
  winner: "home" | "draw" | "away",
  totalGoals: "over" | "under",
  bts: "yes" | "no",
  cleanSheet: "yes" | "no",
  homeGoals: number,
  awayGoals: number,
): bigint {
  const w = winner === "home" ? 0 : winner === "draw" ? 1 : 2;
  const ou = totalGoals === "over" ? 1 : 0;
  const s3 = bts === "yes" ? 1 : 0;
  const s4 = cleanSheet === "yes" ? 1 : 0;
  const ph = BigInt(homeGoals);
  const pa = BigInt(awayGoals);
  return (
    BigInt(w) |
    (BigInt(ou) << BigInt(2)) |
    (BigInt(s3) << BigInt(3)) |
    (BigInt(s4) << BigInt(4)) |
    (ph << BigInt(8)) |
    (pa << BigInt(16))
  );
}

/** Non-soccer: bits 0–1 winner (0 home 1 away 2 tie), 2 O/U, 3–5 yes/no slots. */
export function packNonSoccerFive(
  winnerHomeAwayTie: 0 | 1 | 2,
  totalOver: 0 | 1,
  slot3: 0 | 1,
  slot4: 0 | 1,
  slot5: 0 | 1,
): bigint {
  return (
    BigInt(winnerHomeAwayTie) |
    (BigInt(totalOver) << BigInt(2)) |
    (BigInt(slot3) << BigInt(3)) |
    (BigInt(slot4) << BigInt(4)) |
    (BigInt(slot5) << BigInt(5))
  );
}

export function yesNoBit(v: "yes" | "no"): 0 | 1 {
  return v === "yes" ? 1 : 0;
}

export function overUnderBit(v: "over" | "under"): 0 | 1 {
  return v === "over" ? 1 : 0;
}
