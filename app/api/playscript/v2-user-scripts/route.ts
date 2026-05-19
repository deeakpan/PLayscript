import { NextResponse } from "next/server";
import { formatUnits, getAddress, isAddress } from "viem";

import { fetchEspnFixtureByEventId } from "@/lib/espn-fixtures";
import { describeV2LegMaskPicks } from "@/lib/playscript-v2-legs";
import {
  getPlayscriptV2KernelEnv,
  getPlayscriptV2LockRegistryEnv,
  getPlayscriptV2PositionsEnv,
} from "@/lib/playscript-public-env";
import { readV2LocksWithBalances } from "@/lib/playscript-v2-active-locks";
import { fetchV2UserLocksFromRegistry } from "@/lib/playscript-v2-lock-registry-read";
import { readKernelMatch } from "@/lib/playscript-v2-kernel-read";
import { playscriptV2PositionsReadAbi } from "@/lib/playscript-v2-positions-abi";
import { v2ScriptTokenId } from "@/lib/playscript-v2-script-token-id";
import { sportIndexToKey } from "@/lib/playscript-unpack-picks";
import { fetchFixtureByEventId } from "@/lib/thesportsdb-fixtures";
import { parseLookupeventIdFromUrl } from "@/lib/thesportsdb-url-public";
import {
  fetchV2UserScriptHistory,
  getPlayscriptV2SubgraphUrl,
  isPlayscriptV2SubgraphIndexingError,
  parseEspnEventIdFromMatchUrl,
  type V2SubgraphClaimRow,
  type V2SubgraphLockRow,
} from "@/lib/playscript-v2-subgraph";
import { createSomniaPublicClient } from "@/lib/playscript-read-onchain";

export const dynamic = "force-dynamic";

type ScriptRow = {
  lockId: string;
  matchId: string;
  legMask12: number;
  netStake: string;
  netStakeFormatted: string;
  actualStakeFormatted: string;
  payoutRate: string;
  blockTimestamp: string;
  transactionHash: string;
  matchUrl: string;
  matchSettled: boolean;
  sportIndex: number;
  eventId: string | null;
  sourceLeagueId: string | null;
  claimed: boolean;
  payoutFormatted: string | null;
  homeTeam: string;
  awayTeam: string;
  pickDescriptions: { legId: number; description: string; difficulty: string }[];
  picksPlainText: string;
};

function claimKey(matchId: string, legMask12: number): string {
  return `${matchId}:${legMask12}`;
}

function parseEspnLeagueSlugFromMatchUrl(url: string): string | null {
  const m = url.match(/\/sports\/([^/]+\/[^/]+)\/(?:summary|scoreboard)/i);
  return m?.[1] ?? null;
}

async function resolveTeams(
  matchUrl: string,
): Promise<{ homeTeam: string; awayTeam: string; eventId: string | null; sourceLeagueId: string | null }> {
  const espnEventId = parseEspnEventIdFromMatchUrl(matchUrl);
  const leagueSlug = parseEspnLeagueSlugFromMatchUrl(matchUrl);
  if (espnEventId && leagueSlug) {
    try {
      const row = await fetchEspnFixtureByEventId(leagueSlug, espnEventId);
      if (row) {
        return {
          homeTeam: row.home,
          awayTeam: row.away,
          eventId: espnEventId,
          sourceLeagueId: row.sourceLeagueId ?? leagueSlug,
        };
      }
    } catch {
      /* fall through */
    }
  }

  const tsdbId = parseLookupeventIdFromUrl(matchUrl);
  if (tsdbId) {
    const row = await fetchFixtureByEventId(tsdbId);
    if (row) {
      return {
        homeTeam: row.home,
        awayTeam: row.away,
        eventId: tsdbId,
        sourceLeagueId: row.sourceLeagueId ?? null,
      };
    }
  }

  return { homeTeam: "", awayTeam: "", eventId: espnEventId ?? tsdbId, sourceLeagueId: leagueSlug };
}

async function buildScriptsFromRegistry(owner: `0x${string}`, decimals: number): Promise<ScriptRow[]> {
  const registryEnv = getPlayscriptV2LockRegistryEnv();
  const kernelEnv = getPlayscriptV2KernelEnv();
  const positionsEnv = getPlayscriptV2PositionsEnv();
  if (!registryEnv.ok) {
    throw new Error(registryEnv.reason);
  }
  if (!kernelEnv.ok) {
    throw new Error(kernelEnv.reason);
  }
  if (!positionsEnv.ok) {
    throw new Error(positionsEnv.reason);
  }

  const client = createSomniaPublicClient();
  const allLocks = await fetchV2UserLocksFromRegistry(registryEnv.lockRegistry, owner);
  const locks = await readV2LocksWithBalances(
    client,
    positionsEnv.positions,
    owner,
    allLocks,
  );
  const scripts: ScriptRow[] = [];

  for (let i = 0; i < locks.length; i++) {
    const lock = locks[i]!;
    if (i > 0) await new Promise((r) => setTimeout(r, 80));
    const match = await readKernelMatch(client, kernelEnv.kernel, lock.matchId);
    const matchIdStr = lock.matchId.toString();
    const teams = await resolveTeams(match.url);
    const sportKey = sportIndexToKey(match.sport);
    const fixtureSeed = teams.eventId ?? matchIdStr;
    const registeredLegKinds = match.legKinds.length === 15 ? match.legKinds : undefined;
    const pickDescriptions = describeV2LegMaskPicks(
      fixtureSeed,
      teams.homeTeam,
      teams.awayTeam,
      sportKey,
      lock.legMask12,
      registeredLegKinds,
    ).map((p) => ({ legId: p.legId, description: p.description, difficulty: p.difficulty }));

    const payoutFormatted =
      lock.claimed && match.settled
        ? formatUnits((lock.netStake * lock.payoutRate) / BigInt(10), decimals)
        : null;

    scripts.push({
      lockId: lock.lockId.toString(),
      matchId: matchIdStr,
      legMask12: lock.legMask12,
      netStake: lock.netStake.toString(),
      netStakeFormatted: formatUnits(lock.netStake, decimals),
      actualStakeFormatted: formatUnits(lock.actualStake, decimals),
      payoutRate: lock.payoutRate.toString(),
      blockTimestamp: lock.blockNumber.toString(),
      transactionHash: "",
      matchUrl: match.url,
      matchSettled: match.settled,
      sportIndex: match.sport,
      eventId: teams.eventId,
      sourceLeagueId: teams.sourceLeagueId,
      claimed: lock.claimed,
      payoutFormatted,
      homeTeam: teams.homeTeam,
      awayTeam: teams.awayTeam,
      pickDescriptions,
      picksPlainText: pickDescriptions.map((p) => p.description).join(" · "),
    });
  }

  return scripts;
}

async function buildScriptsFromSubgraph(owner: `0x${string}`, decimals: number): Promise<ScriptRow[]> {
  const subgraphUrl = getPlayscriptV2SubgraphUrl();
  const positionsEnv = getPlayscriptV2PositionsEnv();
  if (!subgraphUrl) {
    throw new Error("Set NEXT_PUBLIC_PLAYSCRIPT_V2_SUBGRAPH_URL to the deployed subgraph endpoint.");
  }
  if (!positionsEnv.ok) {
    throw new Error(positionsEnv.reason);
  }

  const history = await fetchV2UserScriptHistory(subgraphUrl, owner);
  const claimByMask = new Map<string, V2SubgraphClaimRow>();
  for (const c of history.claims) {
    claimByMask.set(claimKey(c.matchId, c.legMask12), c);
  }

  const client = createSomniaPublicClient();
  const scripts: ScriptRow[] = [];

  for (let i = 0; i < history.locks.length; i++) {
    const lock = history.locks[i] as V2SubgraphLockRow;
    const claimed = claimByMask.has(claimKey(lock.matchId, lock.legMask12));
    const tokenId = v2ScriptTokenId(BigInt(lock.matchId), lock.legMask12);
    const balance = await client.readContract({
      address: positionsEnv.positions,
      abi: playscriptV2PositionsReadAbi,
      functionName: "balanceOf",
      args: [owner, tokenId],
    });
    if (balance <= BigInt(0) && !claimed) continue;
    if (i > 0) await new Promise((r) => setTimeout(r, 120));
    const claim = claimByMask.get(claimKey(lock.matchId, lock.legMask12));
    const teams = await resolveTeams(lock.match.url);
    const sportKey = sportIndexToKey(lock.match.sport);
    const fixtureSeed = teams.eventId ?? lock.matchId;
    const kernelEnv = getPlayscriptV2KernelEnv();
    let registeredLegKinds: readonly number[] | undefined;
    if (kernelEnv.ok) {
      try {
        const match = await readKernelMatch(client, kernelEnv.kernel, BigInt(lock.matchId));
        registeredLegKinds = match.legKinds.length === 15 ? match.legKinds : undefined;
      } catch {
        registeredLegKinds = undefined;
      }
    }
    const pickDescriptions = describeV2LegMaskPicks(
      fixtureSeed,
      teams.homeTeam,
      teams.awayTeam,
      sportKey,
      lock.legMask12,
      registeredLegKinds,
    ).map((p) => ({ legId: p.legId, description: p.description, difficulty: p.difficulty }));
    scripts.push({
      lockId: lock.id,
      matchId: lock.matchId,
      legMask12: lock.legMask12,
      netStake: lock.netStake,
      netStakeFormatted: formatUnits(BigInt(lock.netStake), decimals),
      actualStakeFormatted: formatUnits(BigInt(lock.actualStake), decimals),
      payoutRate: lock.payoutRate,
      blockTimestamp: lock.blockTimestamp,
      transactionHash: lock.transactionHash,
      matchUrl: lock.match.url,
      matchSettled: lock.match.settled,
      sportIndex: lock.match.sport,
      eventId: teams.eventId,
      sourceLeagueId: teams.sourceLeagueId,
      claimed: claim != null,
      payoutFormatted:
        claim?.payout != null && claim.payout !== "0"
          ? formatUnits(BigInt(claim.payout), decimals)
          : null,
      homeTeam: teams.homeTeam,
      awayTeam: teams.awayTeam,
      pickDescriptions,
      picksPlainText: pickDescriptions.map((p) => p.description).join(" · "),
    });
  }

  return scripts;
}

export async function GET(req: Request) {
  const rawAddr = new URL(req.url).searchParams.get("address")?.trim() ?? "";
  if (!rawAddr || !isAddress(rawAddr)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid `address`." }, { status: 400 });
  }

  const owner = getAddress(rawAddr);
  const decimals = 18;
  const registryEnv = getPlayscriptV2LockRegistryEnv();
  const subgraphUrl = getPlayscriptV2SubgraphUrl();

  if (!registryEnv.ok && !subgraphUrl) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Configure NEXT_PUBLIC_PLAYSCRIPT_V2_LOCK_REGISTRY_ADDRESS (on-chain index) or NEXT_PUBLIC_PLAYSCRIPT_V2_SUBGRAPH_URL.",
      },
      { status: 503 },
    );
  }

  try {
    const scripts = registryEnv.ok
      ? await buildScriptsFromRegistry(owner, decimals)
      : await buildScriptsFromSubgraph(owner, decimals);
    return NextResponse.json({ ok: true, scripts, decimals, source: registryEnv.ok ? "registry" : "subgraph" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Query failed";
    if (!registryEnv.ok && isPlayscriptV2SubgraphIndexingError(msg)) {
      return NextResponse.json({ ok: true, scripts: [], decimals: 18, indexing: true });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
