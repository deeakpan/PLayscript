/**
 * Client-side mirror of `PlayscriptV2Grading.sol` for live fixture ticks.
 * Onchain settlement still uses the kernel `resolvedLegsBitmask`.
 */

export type V2GradingFacts = {
  finalHome: number;
  finalAway: number;
  htHome: number;
  htAway: number;
  yellowHome: number;
  yellowAway: number;
  redHome: number;
  redAway: number;
  homeQ1: number;
  homeQ2: number;
  awayQ1: number;
  awayQ2: number;
};

export function v2GradingFactsFromScores(
  homeScore: number,
  awayScore: number,
): V2GradingFacts {
  return {
    finalHome: homeScore,
    finalAway: awayScore,
    htHome: 0,
    htAway: 0,
    yellowHome: 0,
    yellowAway: 0,
    redHome: 0,
    redAway: 0,
    homeQ1: 0,
    homeQ2: 0,
    awayQ1: 0,
    awayQ2: 0,
  };
}

/** Same semantics as `PlayscriptV2Grading.legHitByKind`. */
export function v2LegHitByKind(sport: number, kind: number, f: V2GradingFacts): boolean {
  if (sport === 0) return soccerKind(kind, f);
  if (sport === 1) return basketballKind(kind, f);
  if (sport === 2) return nflKind(kind, f);
  if (sport === 3) return mlbKind(kind, f);
  return false;
}

function soccerSecondHalfTotal(f: V2GradingFacts): number {
  return f.finalHome - f.htHome + (f.finalAway - f.htAway);
}

function soccerKind(k: number, f: V2GradingFacts): boolean {
  const h = f.finalHome;
  const a = f.finalAway;
  const ht = f.htHome + f.htAway;
  const yc = f.yellowHome + f.yellowAway;
  switch (k) {
    case 1:
      return h > a;
    case 2:
      return a > h;
    case 3:
      return h === a;
    case 4:
      return h + a >= 3;
    case 5:
      return h + a <= 1;
    case 36:
      return h + a <= 2;
    case 6:
      return h >= 1 && a >= 1;
    case 7:
      return a === 0;
    case 8:
      return h === 0;
    case 9:
      return h > a && h - a >= 2;
    case 10:
      return a > h && a - h >= 2;
    case 11:
      return ht >= 1;
    case 12:
      return h < 3 && a < 3;
    case 13:
      return f.htHome > f.htAway;
    case 14:
      return f.htAway > f.htHome;
    case 15:
      return f.htHome === f.htAway;
    case 16:
      return yc >= 2;
    case 20:
      return f.htHome >= 1;
    case 21:
      return f.htAway >= 1;
    case 23:
      return f.redHome >= 1;
    case 24:
      return f.redAway >= 1;
    case 25:
      return ht >= 2;
    case 26:
      return ht === 0;
    case 27:
      return f.htAway === 0;
    case 28:
      return f.htHome === 0;
    case 29:
      return h >= 2;
    case 30:
      return a >= 2;
    case 31:
      return f.yellowHome >= 1;
    case 32:
      return f.yellowAway >= 1;
    case 33:
      return f.yellowHome >= 2;
    case 34:
      return f.yellowAway >= 2;
    case 35:
      return f.yellowHome >= 1 && f.yellowAway >= 1;
    case 37:
      return soccerSecondHalfTotal(f) >= 2;
    case 39:
      return f.finalHome > f.htHome && f.finalAway > f.htAway;
    default:
      return false;
  }
}

function basketballKind(k: number, f: V2GradingFacts): boolean {
  const h = f.finalHome;
  const a = f.finalAway;
  const t = h + a;
  const h1h = f.homeQ1 + f.homeQ2;
  const a1h = f.awayQ1 + f.awayQ2;
  const q1 = f.homeQ1 + f.awayQ1;
  switch (k) {
    case 41:
      return h > a;
    case 42:
      return a > h;
    case 43:
      return t >= 226;
    case 44:
      return t <= 200;
    case 45:
      return h >= 100 && a >= 100;
    case 46:
      return h < 120 && a < 120;
    case 47:
      return h > a && h - a >= 10;
    case 48:
      return a > h && a - h >= 10;
    case 49:
      return h1h + a1h >= 116;
    case 50:
      return t >= 230;
    case 51: {
      const m = h > a ? h - a : a - h;
      return m >= 20;
    }
    case 52:
      return h < 110 && a < 110;
    case 53:
      return q1 >= 56;
    case 54:
      return f.homeQ1 >= 28;
    case 55:
      return f.awayQ1 >= 28;
    default:
      return false;
  }
}

function nflKind(k: number, f: V2GradingFacts): boolean {
  const h = f.finalHome;
  const a = f.finalAway;
  const t = h + a;
  const h1h = f.homeQ1 + f.homeQ2;
  const a1h = f.awayQ1 + f.awayQ2;
  const q1 = f.homeQ1 + f.awayQ1;
  switch (k) {
    case 61:
      return h > a;
    case 62:
      return a > h;
    case 63:
      return t >= 46;
    case 64:
      return t <= 38;
    case 65:
      return h >= 17 && a >= 17;
    case 66:
      return a <= 10;
    case 67:
      return h <= 10;
    case 68: {
      const m = h > a ? h - a : a - h;
      return m >= 10;
    }
    case 69:
      return h1h + a1h >= 24;
    case 70:
      return h >= 24 && a >= 24;
    case 71:
      return t >= 55;
    case 72:
      return h === 0 || a === 0;
    case 73:
      return q1 >= 15;
    case 74:
      return h >= 20;
    case 75:
      return a >= 20;
    default:
      return false;
  }
}

function mlbKind(k: number, f: V2GradingFacts): boolean {
  const h = f.finalHome;
  const a = f.finalAway;
  const t = h + a;
  switch (k) {
    case 81:
      return h > a;
    case 82:
      return a > h;
    case 83:
      return t >= 10;
    case 84:
      return t <= 7;
    case 85:
      return h >= 4 && a >= 4;
    case 86:
      return h >= 5;
    case 87:
      return a >= 5;
    case 88:
      return t >= 10;
    case 89: {
      const m = h > a ? h - a : a - h;
      return m >= 3;
    }
    case 90:
      return h >= 1 && a >= 1;
    case 91:
      return h === 0 || a === 0;
    case 92:
      return h < 7 && a < 7;
    case 93:
      return t >= 9;
    case 94:
      return h >= 3;
    case 95:
      return a >= 3;
    default:
      return false;
  }
}

/** Leg needs HT / cards / quarters we do not have from the live score feed alone. */
export function v2LegNeedsExtraStats(sport: number, kind: number): boolean {
  if (sport === 0) {
    return (
      kind === 11 ||
      kind === 13 ||
      kind === 14 ||
      kind === 15 ||
      kind === 16 ||
      kind === 20 ||
      kind === 21 ||
      kind === 23 ||
      kind === 24 ||
      kind === 25 ||
      kind === 26 ||
      kind === 27 ||
      kind === 28 ||
      kind === 31 ||
      kind === 32 ||
      kind === 33 ||
      kind === 34 ||
      kind === 35 ||
      kind === 37 ||
      kind === 39
    );
  }
  if (sport === 1 || sport === 2) {
    return kind === 49 || kind === 53 || kind === 54 || kind === 55 || kind === 73;
  }
  return false;
}

/** Pick is definitely lost given current facts (cannot become true). */
export function v2LegPickFailedEarly(sport: number, kind: number, f: V2GradingFacts): boolean {
  const h = f.finalHome;
  const a = f.finalAway;
  const t = h + a;

  if (sport === 0) {
    if (kind === 5 && t >= 2) return true;
    if (kind === 36 && t >= 3) return true;
    if (kind === 7 && a >= 1) return true;
    if (kind === 8 && h >= 1) return true;
    if (kind === 6 && (h === 0 || a === 0) && false) return false; // BTTS not failed until FT
    if (kind === 4) return false;
    return false;
  }
  if (sport === 1) {
    if (kind === 44 && t > 200) return true;
    if (kind === 46 && (h >= 120 || a >= 120)) return true;
    if (kind === 52 && (h >= 110 || a >= 110)) return true;
    return false;
  }
  if (sport === 2) {
    if (kind === 64 && t > 38) return true;
    if (kind === 66 && a > 10) return true;
    if (kind === 67 && h > 10) return true;
    return false;
  }
  if (sport === 3) {
    if (kind === 84 && t > 7) return true;
    if (kind === 92 && (h >= 7 || a >= 7)) return true;
    return false;
  }
  return false;
}

/** Pick is already satisfied and cannot be undone (live feed only). */
export function v2LegPickWonEarly(sport: number, kind: number, f: V2GradingFacts): boolean {
  const h = f.finalHome;
  const a = f.finalAway;
  const t = h + a;

  if (sport === 0) {
    if (kind === 4 && t >= 3) return true;
    if (kind === 6 && h >= 1 && a >= 1) return true;
    if (kind === 29 && h >= 2) return true;
    if (kind === 30 && a >= 2) return true;
    if (kind === 16 && f.yellowHome + f.yellowAway >= 2) return true;
    return false;
  }
  if (sport === 1) {
    if (kind === 43 && t >= 226) return true;
    if (kind === 45 && h >= 100 && a >= 100) return true;
    if (kind === 50 && t >= 230) return true;
    return false;
  }
  if (sport === 2) {
    if (kind === 63 && t >= 46) return true;
    if (kind === 65 && h >= 17 && a >= 17) return true;
    if (kind === 71 && t >= 55) return true;
    return false;
  }
  if (sport === 3) {
    if (kind === 83 && t >= 10) return true;
    if (kind === 85 && h >= 4 && a >= 4) return true;
    if (kind === 88 && t >= 10) return true;
    if (kind === 93 && t >= 9) return true;
    return false;
  }
  return false;
}

/** Live / in-progress tick: `null` = still open, boolean = known from current state. */
export function evaluateV2LegPickLive(
  sport: number,
  kind: number,
  facts: V2GradingFacts,
  matchEnded: boolean,
): boolean | null {
  if (matchEnded) return v2LegHitByKind(sport, kind, facts);
  if (v2LegNeedsExtraStats(sport, kind)) return null;
  if (v2LegPickFailedEarly(sport, kind, facts)) return false;
  if (v2LegPickWonEarly(sport, kind, facts)) return true;
  return null;
}
