import { NextRequest, NextResponse } from "next/server";

import {
  ALL_LEAGUES_ID,
  getLeagueIdsForSport,
  isScriptSportKey,
  leagueIdMatchesSport,
  type ScriptSportKey,
  UPCOMING_LEAGUE_ID_SET,
} from "@/lib/fixtures-shared";
import {
  fetchUpcomingFixtures,
  fetchUpcomingFixturesMerged,
  THESPORTSDB_LIST_REVALIDATE_SEC,
} from "@/lib/thesportsdb-fixtures";

export async function GET(req: NextRequest) {
  const sportRaw = req.nextUrl.searchParams.get("sport") ?? "soccer";
  const leagueId = req.nextUrl.searchParams.get("leagueId") ?? ALL_LEAGUES_ID;

  if (!isScriptSportKey(sportRaw)) {
    return NextResponse.json({ error: "Unsupported sport" }, { status: 400 });
  }
  const sport: ScriptSportKey = sportRaw;

  if (leagueId !== ALL_LEAGUES_ID && !UPCOMING_LEAGUE_ID_SET.has(leagueId)) {
    return NextResponse.json({ error: "Unsupported leagueId" }, { status: 400 });
  }
  if (leagueId !== ALL_LEAGUES_ID && !leagueIdMatchesSport(leagueId, sport)) {
    return NextResponse.json(
      { error: "leagueId does not belong to the requested sport" },
      { status: 400 },
    );
  }

  try {
    const fixtures =
      leagueId === ALL_LEAGUES_ID
        ? await fetchUpcomingFixturesMerged(getLeagueIdsForSport(sport))
        : await fetchUpcomingFixtures(leagueId);
    return NextResponse.json(
      { fixtures },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${THESPORTSDB_LIST_REVALIDATE_SEC}`,
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
