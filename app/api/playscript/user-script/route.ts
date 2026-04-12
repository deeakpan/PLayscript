import { NextResponse } from "next/server";
import { formatUnits, getAddress, isAddress } from "viem";

import { findUserScriptForMatch } from "@/lib/playscript-find-user-script";
import { claimPayoutPreview, gradePlayscriptSlots } from "@/lib/playscript-grade";
import { getPlayscriptClientEnv } from "@/lib/playscript-public-env";
import { createSomniaPublicClient } from "@/lib/playscript-read-onchain";
import { playTokenReadAbi, playscriptCoreReadAbi } from "@/lib/playscript-onchain-abi";
import { parseMatchesRead } from "@/lib/playscript-parse-match-read";
import { describePackedPicks } from "@/lib/playscript-unpack-picks";

export const dynamic = "force-dynamic";

function jsonSettlement(parsed: NonNullable<ReturnType<typeof parseMatchesRead>>, chainNowUnix: number) {
  const finalizeAtUnix = Number(parsed.kickoff) + parsed.finalizeDelaySec;
  return {
    finalizeAtUnix,
    chainNowUnix,
    settlementWindowOpen: chainNowUnix >= finalizeAtUnix,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawAddr = searchParams.get("address")?.trim() ?? "";
  const rawMatch = searchParams.get("matchId")?.trim() ?? "";

  if (!rawAddr || !isAddress(rawAddr)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid `address`." }, { status: 400 });
  }
  if (!/^\d+$/.test(rawMatch)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid `matchId` (non-negative integer)." }, { status: 400 });
  }

  const owner = getAddress(rawAddr) as `0x${string}`;
  const matchId = BigInt(rawMatch);

  const env = getPlayscriptClientEnv();
  if (!env.ok) {
    return NextResponse.json(
      { ok: false, error: "Playscript env not configured (core + PLAY token)." },
      { status: 503 },
    );
  }

  try {
    const client = createSomniaPublicClient();
    const [matchRow, latestBlock] = await Promise.all([
      client.readContract({
        address: env.playscriptCore,
        abi: playscriptCoreReadAbi,
        functionName: "matches_",
        args: [matchId],
      }),
      client.getBlock({ blockTag: "latest" }),
    ]);

    const parsed = parseMatchesRead(matchRow as unknown);
    if (!parsed) {
      return NextResponse.json({ ok: false, error: "Unexpected matches_ shape." }, { status: 502 });
    }
    if (!parsed.exists) {
      return NextResponse.json({ ok: false, error: "Match does not exist on-chain." }, { status: 404 });
    }

    const chainNowUnix = Number(latestBlock.timestamp);
    const settlement = jsonSettlement(parsed, chainNowUnix);
    const settled = parsed.settled;
    const sportIndex = parsed.sport;

    const found = await findUserScriptForMatch(env.playscriptCore, owner, matchId);
    if (!found) {
      return NextResponse.json({
        ok: true,
        hasScript: false,
        matchSettled: settled,
        sportIndex,
        settlement,
        script: null,
      });
    }

    const { scriptId, script } = found;
    const decRaw = await client.readContract({
      address: env.playToken,
      abi: playTokenReadAbi,
      functionName: "decimals",
    });
    const decimals =
      Number.isFinite(Number(decRaw)) && Number(decRaw) >= 0 && Number(decRaw) <= 36
        ? Number(decRaw)
        : 18;
    const stakeFormatted = formatUnits(script.stake, decimals);
    const slotPicks = describePackedPicks(sportIndex, script.picksPacked);

    let grading: {
      correctSlots: number;
      rows: { label: string; yourPick: string; result: string; correct: boolean }[];
      finalHome: string;
      finalAway: string;
    } | null = null;

    let claim: {
      winner: boolean;
      tierLabel: string;
      mintUserFormatted: string;
      mintFeeFormatted: string;
      mintUserWei: string;
      mintFeeWei: string;
      showClaimButton: boolean;
    } | null = null;

    if (settled) {
      const g = gradePlayscriptSlots(sportIndex, script.picksPacked, parsed.finalHome, parsed.finalAway);
      grading = {
        correctSlots: g.correctSlots,
        rows: g.rows,
        finalHome: parsed.finalHome.toString(),
        finalAway: parsed.finalAway.toString(),
      };
      const prev = claimPayoutPreview(g.correctSlots, script.stake);
      claim = {
        winner: prev.winner,
        tierLabel: prev.tierLabel,
        mintUserFormatted: formatUnits(prev.mintUserWei, decimals),
        mintFeeFormatted: formatUnits(prev.mintFeeWei, decimals),
        mintUserWei: prev.mintUserWei.toString(),
        mintFeeWei: prev.mintFeeWei.toString(),
        showClaimButton: !script.claimed,
      };
    }

    return NextResponse.json({
      ok: true,
      hasScript: true,
      matchSettled: settled,
      sportIndex,
      settlement,
      grading,
      claim,
      script: {
        scriptId: scriptId.toString(),
        matchId: script.matchId.toString(),
        owner: script.owner,
        stake: script.stake.toString(),
        stakeFormatted,
        decimals,
        picksPacked: script.picksPacked.toString(),
        choicesReceipt: script.choicesReceipt,
        claimed: script.claimed,
        slotPicks,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "RPC failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
