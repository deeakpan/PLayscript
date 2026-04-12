import { NextResponse } from "next/server";
import { formatUnits, getAddress, isAddress } from "viem";

import { findUserScriptForMatch } from "@/lib/playscript-find-user-script";
import { getPlayscriptClientEnv } from "@/lib/playscript-public-env";
import { createSomniaPublicClient } from "@/lib/playscript-read-onchain";
import { playTokenReadAbi, playscriptCoreReadAbi } from "@/lib/playscript-onchain-abi";
import { describePackedPicks } from "@/lib/playscript-unpack-picks";

export const dynamic = "force-dynamic";

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
    const matchRow = await client.readContract({
      address: env.playscriptCore,
      abi: playscriptCoreReadAbi,
      functionName: "matches_",
      args: [matchId],
    });

    const row = matchRow as unknown;
    let exists: boolean;
    let settled: boolean;
    let sportIndex: number;
    if (Array.isArray(row)) {
      sportIndex = Number(row[0]);
      exists = Boolean(row[5]);
      settled = Boolean(row[6]);
    } else if (row && typeof row === "object") {
      const o = row as Record<string, unknown>;
      sportIndex = Number(o.sport ?? 0);
      exists = Boolean(o.exists);
      settled = Boolean(o.settled);
    } else {
      return NextResponse.json({ ok: false, error: "Unexpected matches_ shape." }, { status: 502 });
    }
    if (!exists) {
      return NextResponse.json({ ok: false, error: "Match does not exist on-chain." }, { status: 404 });
    }

    const found = await findUserScriptForMatch(env.playscriptCore, owner, matchId);
    if (!found) {
      return NextResponse.json({
        ok: true,
        hasScript: false,
        matchSettled: settled,
        sportIndex,
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

    return NextResponse.json({
      ok: true,
      hasScript: true,
      matchSettled: settled,
      sportIndex,
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
