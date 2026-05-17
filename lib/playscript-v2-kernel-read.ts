import type { PublicClient } from "viem";

import { playscriptKernelLegacyReadAbi } from "@/lib/playscript-v2-kernel-legacy-abi";
import { playscriptKernelReadAbi } from "@/lib/playscript-v2-kernel-abi";

export type KernelMatchSchema = "espn-v2" | "legacy-v1";

export type ParsedKernelMatch = {
  schema: KernelMatchSchema;
  sport: number;
  kickoff: bigint;
  finalizeDelaySec: number;
  url: string;
  state: number;
  exists: boolean;
  settled: boolean;
  settleInProgress: boolean;
  resolvedLegsBitmask: number;
  finalHome: bigint;
  finalAway: bigint;
  matchLiability: bigint;
  matchLiabilityCap: bigint;
};

function asBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.trunc(v));
  if (typeof v === "string" && v.trim() !== "") return BigInt(v);
  throw new Error(`Expected bigint-like value, got ${String(v)}`);
}

function asUint8(v: unknown): number {
  const n = typeof v === "bigint" ? Number(v) : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 255) {
    throw new Error(`Expected uint8, got ${String(v)}`);
  }
  return n;
}

function asUint16(v: unknown): number {
  const n = typeof v === "bigint" ? Number(v) : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 0xffff) {
    throw new Error(`Expected uint16, got ${String(v)}`);
  }
  return n;
}

function asBool(v: unknown): boolean {
  return Boolean(v);
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function parseLegacyMatchRow(row: unknown): ParsedKernelMatch {
  if (row && typeof row === "object" && !Array.isArray(row)) {
    const o = row as Record<string, unknown>;
    return {
      schema: "legacy-v1",
      sport: asUint8(o.sport),
      kickoff: asBigInt(o.kickoff),
      finalizeDelaySec: Number(o.finalizeDelaySec ?? 0),
      url: asString(o.url),
      state: asUint8(o.state),
      exists: asBool(o.exists),
      settled: asBool(o.settled),
      settleInProgress: asBool(o.settleInProgress),
      resolvedLegsBitmask: asUint16(o.resolvedLegsBitmask),
      finalHome: asBigInt(o.finalHome),
      finalAway: asBigInt(o.finalAway),
      matchLiability: BigInt(0),
      matchLiabilityCap: BigInt(0),
    };
  }
  if (!Array.isArray(row)) throw new Error("Unexpected legacy matches row shape");
  return {
    schema: "legacy-v1",
    sport: asUint8(row[0]),
    kickoff: asBigInt(row[1]),
    finalizeDelaySec: Number(row[2] ?? 0),
    url: asString(row[3]),
    state: asUint8(row[5]),
    exists: asBool(row[7]),
    settled: asBool(row[8]),
    settleInProgress: asBool(row[9]),
    resolvedLegsBitmask: asUint16(row[13]),
    finalHome: asBigInt(row[11]),
    finalAway: asBigInt(row[12]),
    matchLiability: BigInt(0),
    matchLiabilityCap: BigInt(0),
  };
}

function parseEspnV2MatchRow(row: unknown): ParsedKernelMatch {
  if (row && typeof row === "object" && !Array.isArray(row)) {
    const o = row as Record<string, unknown>;
    return {
      schema: "espn-v2",
      sport: asUint8(o.sport),
      kickoff: asBigInt(o.kickoff),
      finalizeDelaySec: Number(o.finalizeDelaySec ?? 0),
      url: asString(o.url),
      state: asUint8(o.state),
      exists: asBool(o.exists),
      settled: asBool(o.settled),
      settleInProgress: asBool(o.settleInProgress),
      resolvedLegsBitmask: asUint16(o.resolvedLegsBitmask),
      finalHome: asBigInt(o.finalHome),
      finalAway: asBigInt(o.finalAway),
      matchLiability: asBigInt(o.matchLiability),
      matchLiabilityCap: asBigInt(o.matchLiabilityCap),
    };
  }
  throw new Error("Unexpected ESPN v2 matches row shape");
}

function isAbiMismatchError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("safe integer range") ||
    msg.includes("out of bounds") ||
    msg.includes("Position") ||
    msg.includes("overflow")
  );
}

/** Read `matches` with ABI auto-fallback (legacy kernel vs ESPN-expanded struct). */
export async function readKernelMatch(
  client: PublicClient,
  kernelAddress: `0x${string}`,
  matchId: bigint,
): Promise<ParsedKernelMatch> {
  try {
    const row = await client.readContract({
      address: kernelAddress,
      abi: playscriptKernelReadAbi,
      functionName: "matches",
      args: [matchId],
    });
    return parseEspnV2MatchRow(row);
  } catch (e) {
    if (!isAbiMismatchError(e)) throw e;
    const row = await client.readContract({
      address: kernelAddress,
      abi: playscriptKernelLegacyReadAbi,
      functionName: "matches",
      args: [matchId],
    });
    return parseLegacyMatchRow(row);
  }
}

export function kernelMatchRowExists(row: ParsedKernelMatch): boolean {
  return row.exists;
}

export function extractKernelMatchUrl(row: ParsedKernelMatch): string {
  return row.url;
}
