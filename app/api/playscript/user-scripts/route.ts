import { NextResponse } from "next/server";
import { formatUnits, getAddress, isAddress } from "viem";

import { findAllUserScriptsForOwner } from "@/lib/playscript-find-user-script";
import { getPlayscriptClientEnv } from "@/lib/playscript-public-env";
import { createSomniaPublicClient } from "@/lib/playscript-read-onchain";
import { playTokenReadAbi, playscriptCoreReadAbi } from "@/lib/playscript-onchain-abi";
import { fetchFixtureByEventId } from "@/lib/thesportsdb-fixtures";
import { parseLookupeventIdFromUrl } from "@/lib/thesportsdb-url-public";

export const dynamic = "force-dynamic";

type SelTeams = { homeTeam: string; awayTeam: string };

function readSelTeams(row: unknown): SelTeams {
  if (!Array.isArray(row)) return { homeTeam: "", awayTeam: "" };
  const sel = row[4];
  if (Array.isArray(sel)) {
    return {
      homeTeam: String(sel[3] ?? ""),
      awayTeam: String(sel[4] ?? ""),
    };
  }
  if (sel && typeof sel === "object") {
    const s = sel as Record<string, unknown>;
    return {
      homeTeam: String(s.homeTeam ?? ""),
      awayTeam: String(s.awayTeam ?? ""),
    };
  }
  return { homeTeam: "", awayTeam: "" };
}

function readMatchListFields(row: unknown): {
  sport: number;
  settled: boolean;
  exists: boolean;
  url: string;
} & SelTeams {
  if (Array.isArray(row)) {
    return {
      sport: Number(row[0]),
      settled: Boolean(row[6]),
      exists: Boolean(row[5]),
      url: String(row[3] ?? ""),
      ...readSelTeams(row),
    };
  }
  if (row && typeof row === "object") {
    const o = row as Record<string, unknown>;
    const sel = o.sel;
    let homeTeam = "";
    let awayTeam = "";
    if (sel && typeof sel === "object") {
      const s = sel as Record<string, unknown>;
      homeTeam = String(s.homeTeam ?? "");
      awayTeam = String(s.awayTeam ?? "");
    }
    return {
      sport: Number(o.sport ?? 0),
      settled: Boolean(o.settled),
      exists: Boolean(o.exists),
      url: String(o.url ?? ""),
      homeTeam,
      awayTeam,
    };
  }
  return { sport: 0, settled: false, exists: false, url: "", homeTeam: "", awayTeam: "" };
}

/** On-chain `sel.homeTeam` / `sel.awayTeam` are agent JSON paths (e.g. `events[0].strHomeTeam`), not labels. */
function looksLikeAgentSelectorPath(s: string): boolean {
  return s.trim().toLowerCase().includes("events[");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawAddr = searchParams.get("address")?.trim() ?? "";

  if (!rawAddr || !isAddress(rawAddr)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid `address`." }, { status: 400 });
  }

  const owner = getAddress(rawAddr) as `0x${string}`;
  const env = getPlayscriptClientEnv();
  if (!env.ok) {
    return NextResponse.json(
      { ok: false, error: "Playscript env not configured (core + PLAY token)." },
      { status: 503 },
    );
  }

  try {
    const client = createSomniaPublicClient();
    const decRaw = await client.readContract({
      address: env.playToken,
      abi: playTokenReadAbi,
      functionName: "decimals",
    });
    const decimals =
      Number.isFinite(Number(decRaw)) && Number(decRaw) >= 0 && Number(decRaw) <= 36
        ? Number(decRaw)
        : 18;

    const rows = await findAllUserScriptsForOwner(env.playscriptCore, owner);

    const scripts = await Promise.all(
      rows.map(async ({ scriptId, script }) => {
        const matchRow = await client.readContract({
          address: env.playscriptCore,
          abi: playscriptCoreReadAbi,
          functionName: "matches_",
          args: [script.matchId],
        });
        const m = readMatchListFields(matchRow as unknown);
        const eventId = m.url ? parseLookupeventIdFromUrl(m.url) : null;
        const stakeFormatted = formatUnits(script.stake, decimals);

        let homeTeam = m.homeTeam.trim();
        let awayTeam = m.awayTeam.trim();
        let sourceLeagueId: string | undefined;
        if (looksLikeAgentSelectorPath(homeTeam) || looksLikeAgentSelectorPath(awayTeam)) {
          homeTeam = "";
          awayTeam = "";
        }
        if (eventId) {
          const fixture = await fetchFixtureByEventId(eventId);
          if (fixture) {
            homeTeam = fixture.home.trim();
            awayTeam = fixture.away.trim();
            sourceLeagueId = fixture.sourceLeagueId?.trim() || undefined;
          }
        }

        return {
          scriptId: scriptId.toString(),
          matchId: script.matchId.toString(),
          sportIndex: m.sport,
          stake: script.stake.toString(),
          stakeFormatted,
          decimals,
          claimed: script.claimed,
          matchExists: m.exists,
          matchSettled: m.settled,
          matchUrl: m.url,
          eventId,
          sourceLeagueId: sourceLeagueId ?? null,
          homeTeam,
          awayTeam,
        };
      }),
    );

    return NextResponse.json({ ok: true, scripts });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "RPC failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
