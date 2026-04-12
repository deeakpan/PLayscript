/** Normalize `matches_` return from viem (tuple array or object). */
export type ParsedMatchRow = {
  sport: number;
  kickoff: bigint;
  finalizeDelaySec: number;
  exists: boolean;
  settled: boolean;
  finalHome: bigint;
  finalAway: bigint;
};

export function parseMatchesRead(row: unknown): ParsedMatchRow | null {
  if (Array.isArray(row)) {
    return {
      sport: Number(row[0]),
      kickoff: BigInt(row[1] as bigint | number | string),
      finalizeDelaySec: Number(row[2]),
      exists: Boolean(row[5]),
      settled: Boolean(row[6]),
      finalHome: BigInt(row[9] as bigint | number | string),
      finalAway: BigInt(row[10] as bigint | number | string),
    };
  }
  if (row && typeof row === "object") {
    const o = row as Record<string, unknown>;
    return {
      sport: Number(o.sport ?? 0),
      kickoff: BigInt(String(o.kickoff ?? 0)),
      finalizeDelaySec: Number(o.finalizeDelaySec ?? 0),
      exists: Boolean(o.exists),
      settled: Boolean(o.settled),
      finalHome: BigInt(String(o.finalHome ?? 0)),
      finalAway: BigInt(String(o.finalAway ?? 0)),
    };
  }
  return null;
}
