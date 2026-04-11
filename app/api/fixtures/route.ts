import { NextRequest, NextResponse } from "next/server";

import { ALL_LEAGUES_ID, UPCOMING_LEAGUES } from "@/lib/fixtures-shared";
import {
  fetchUpcomingFixtures,
  fetchUpcomingFixturesAll,
  THESPORTSDB_LIST_REVALIDATE_SEC,
} from "@/lib/thesportsdb-fixtures";

const allowedIds = new Set<string>([
  ALL_LEAGUES_ID,
  ...UPCOMING_LEAGUES.map((l) => l.id),
]);

export async function GET(req: NextRequest) {
  const leagueId = req.nextUrl.searchParams.get("leagueId") ?? ALL_LEAGUES_ID;
  if (!allowedIds.has(leagueId)) {
    return NextResponse.json({ error: "Unsupported leagueId" }, { status: 400 });
  }

  try {
    const fixtures =
      leagueId === ALL_LEAGUES_ID
        ? await fetchUpcomingFixturesAll()
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
