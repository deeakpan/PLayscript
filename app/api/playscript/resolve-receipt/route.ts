import { NextResponse } from "next/server";

import { findScriptByReceipt } from "@/lib/playscript-find-user-script";
import { getPlayscriptClientEnv } from "@/lib/playscript-public-env";
import { createSomniaPublicClient } from "@/lib/playscript-read-onchain";
import { playscriptCoreReadAbi } from "@/lib/playscript-onchain-abi";
import { fetchFixtureByEventId } from "@/lib/thesportsdb-fixtures";
import { parseLookupeventIdFromUrl } from "@/lib/thesportsdb-url-public";

export const dynamic = "force-dynamic";

function isBytes32Hex(value: string): value is `0x${string}` {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const receiptRaw = searchParams.get("receipt")?.trim() ?? "";
  if (!isBytes32Hex(receiptRaw)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid `receipt`." }, { status: 400 });
  }

  const env = getPlayscriptClientEnv();
  if (!env.ok) {
    return NextResponse.json(
      { ok: false, error: "Playscript env not configured (core + PLAY token)." },
      { status: 503 },
    );
  }

  try {
    const hit = await findScriptByReceipt(env.playscriptCore, receiptRaw);
    if (!hit) {
      return NextResponse.json({ ok: false, error: "Receipt not found." }, { status: 404 });
    }

    const client = createSomniaPublicClient();
    const matchRow = await client.readContract({
      address: env.playscriptCore,
      abi: playscriptCoreReadAbi,
      functionName: "matches_",
      args: [hit.script.matchId],
    });
    const url = Array.isArray(matchRow) ? String(matchRow[3] ?? "") : "";
    const eventId = parseLookupeventIdFromUrl(url);
    if (!eventId) {
      return NextResponse.json(
        { ok: false, error: "Receipt found, but fixture event could not be resolved." },
        { status: 422 },
      );
    }

    const fixture = await fetchFixtureByEventId(eventId);
    return NextResponse.json({
      ok: true,
      eventId,
      sourceLeagueId: fixture?.sourceLeagueId ?? null,
      matchId: hit.script.matchId.toString(),
      picksPacked: hit.script.picksPacked.toString(),
      choicesReceipt: hit.script.choicesReceipt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "RPC failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
