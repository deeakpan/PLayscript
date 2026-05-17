import { NextRequest, NextResponse } from "next/server";

import {
  ALL_LEAGUES_ID,
  getLeagueIdsForSport,
  isScriptSportKey,
  leagueIdMatchesSport,
  type ScriptSportKey,
  UPCOMING_LEAGUE_ID_SET,
  UPCOMING_LEAGUES,
} from "@/lib/fixtures-shared";
import { formatEspnNetworkError } from "@/lib/espn-fetch";
import {
  espnDevMockEnabled,
  getEspnDevMockFixtures,
} from "@/lib/espn-fixtures-dev-mock";
import {
  ESPN_FIXTURE_WINDOW_DAYS,
  ESPN_LIST_REVALIDATE_SEC,
  fetchEspnFixturesForLeague,
} from "@/lib/espn-fixtures";

async function fetchEspnFixturesMerged(leagueSlugs: readonly string[]) {
  if (espnDevMockEnabled()) {
    const merged = getEspnDevMockFixtures();
    return merged.filter((r) => r.sourceLeagueId && leagueSlugs.includes(r.sourceLeagueId));
  }

  const settled = await Promise.allSettled(
    leagueSlugs.map((slug) => {
      const label = UPCOMING_LEAGUES.find((l) => l.id === slug)?.label ?? slug;
      return fetchEspnFixturesForLeague(slug, label);
    }),
  );

  const merged: Awaited<ReturnType<typeof fetchEspnFixturesForLeague>> = [];
  const errors: string[] = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i]!;
    if (r.status === "fulfilled") {
      merged.push(...r.value);
      continue;
    }
    const slug = leagueSlugs[i]!;
    errors.push(`${slug}: ${formatEspnNetworkError(r.reason)}`);
  }

  if (merged.length === 0 && errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  merged.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
  return merged;
}

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
        ? await fetchEspnFixturesMerged(getLeagueIdsForSport(sport))
        : await fetchEspnFixturesForLeague(
            leagueId,
            UPCOMING_LEAGUES.find((l) => l.id === leagueId)?.label ?? leagueId,
          );
    return NextResponse.json(
      {
        fixtures,
        source: espnDevMockEnabled() ? "espn-dev-mock" : "espn",
        windowDays: ESPN_FIXTURE_WINDOW_DAYS,
      },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${ESPN_LIST_REVALIDATE_SEC}`,
        },
      },
    );
  } catch (e) {
    const message = formatEspnNetworkError(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
