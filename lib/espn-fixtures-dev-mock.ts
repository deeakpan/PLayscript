import "server-only";

import type { FixtureRow } from "@/lib/fixtures-shared";
import { getSportKeyForSourceLeagueId, UPCOMING_LEAGUES } from "@/lib/fixtures-shared";
import mockBundle from "@/lib/espn-mock-hardcoded.generated.json";

function leagueLabel(slug: string): string {
  return UPCOMING_LEAGUES.find((l) => l.id === slug)?.label ?? slug;
}

function soccerRow(
  leagueSlug: string,
  eventId: string,
  home: string,
  away: string,
  homeScore: number,
  awayScore: number,
): FixtureRow {
  const kickoff = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  return {
    id: eventId,
    league: leagueLabel(leagueSlug),
    home,
    away,
    sportKey: getSportKeyForSourceLeagueId(leagueSlug),
    kickoffUtc: kickoff,
    status: "finished",
    sourceLeagueId: leagueSlug,
    homeScore,
    awayScore,
    statusDetail: "STATUS_FULL_TIME (dev mock)",
  };
}

/** Static fixtures from `espn-mock-hardcoded.generated.json` probe bundle (no live ESPN). */
export function getEspnDevMockFixtures(leagueSlug?: string): FixtureRow[] {
  const probes = mockBundle.probes as Record<string, unknown>;
  const rows: FixtureRow[] = [];

  const eng1 = probes.soccer_eng1 as {
    league: string;
    eventId: string;
    soccerHalvesFromSummaryHeader?: { headerHomeTeam?: string; headerAwayTeam?: string };
    final?: { home?: string; away?: string };
  };
  if (eng1?.eventId) {
    rows.push(
      soccerRow(
        eng1.league,
        eng1.eventId,
        eng1.soccerHalvesFromSummaryHeader?.headerHomeTeam ?? "Home",
        eng1.soccerHalvesFromSummaryHeader?.headerAwayTeam ?? "Away",
        Number(eng1.final?.home ?? 0),
        Number(eng1.final?.away ?? 0),
      ),
    );
  }

  const eng1Alt = probes.soccer_eng1_alt as {
    league: string;
    eventId: string;
    soccerHalvesFromSummaryHeader?: { headerHomeTeam?: string; headerAwayTeam?: string };
    final?: { home?: string; away?: string };
  };
  if (eng1Alt?.eventId) {
    rows.push(
      soccerRow(
        eng1Alt.league,
        eng1Alt.eventId,
        eng1Alt.soccerHalvesFromSummaryHeader?.headerHomeTeam ?? "Home",
        eng1Alt.soccerHalvesFromSummaryHeader?.headerAwayTeam ?? "Away",
        Number(eng1Alt.final?.home ?? 0),
        Number(eng1Alt.final?.away ?? 0),
      ),
    );
  }

  const scan = probes.soccer_eng1_half_source_scan as Record<
    string,
    {
      meta?: { eventId?: string };
      diagnose?: {
        headerHalves?: { headerHomeTeam?: string; headerAwayTeam?: string };
        headerFinalScores?: { home?: string; away?: string };
      };
    }
  >;
  if (scan) {
    for (const entry of Object.values(scan)) {
      const eventId = entry.meta?.eventId;
      const h = entry.diagnose?.headerHalves;
      const fin = entry.diagnose?.headerFinalScores;
      if (!eventId || !h?.headerHomeTeam || !h?.headerAwayTeam) continue;
      rows.push(
        soccerRow(
          "soccer/eng.1",
          eventId,
          h.headerHomeTeam,
          h.headerAwayTeam,
          Number(fin?.home ?? 0),
          Number(fin?.away ?? 0),
        ),
      );
    }
  }

  const nba = probes.nba as {
    league: string;
    eventId: string;
    scoreboard_period_scores?: { homeTeam?: string; awayTeam?: string };
    final?: { home?: string; away?: string };
  };
  if (nba?.eventId) {
    rows.push(
      soccerRow(
        nba.league,
        nba.eventId,
        nba.scoreboard_period_scores?.homeTeam ?? "Home",
        nba.scoreboard_period_scores?.awayTeam ?? "Away",
        Number(nba.final?.home ?? 0),
        Number(nba.final?.away ?? 0),
      ),
    );
  }

  const nfl = probes.nfl as typeof nba;
  if (nfl?.eventId) {
    rows.push(
      soccerRow(
        nfl.league,
        nfl.eventId,
        nfl.scoreboard_period_scores?.homeTeam ?? "Home",
        nfl.scoreboard_period_scores?.awayTeam ?? "Away",
        Number(nfl.final?.home ?? 0),
        Number(nfl.final?.away ?? 0),
      ),
    );
  }

  const mlb = probes.mlb as typeof nba;
  if (mlb?.eventId) {
    rows.push(
      soccerRow(
        mlb.league,
        mlb.eventId,
        mlb.scoreboard_period_scores?.homeTeam ?? "Home",
        mlb.scoreboard_period_scores?.awayTeam ?? "Away",
        Number(mlb.final?.home ?? 0),
        Number(mlb.final?.away ?? 0),
      ),
    );
  }

  const filtered = leagueSlug
    ? rows.filter((r) => r.sourceLeagueId === leagueSlug)
    : rows;
  filtered.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
  return filtered;
}

export function espnDevMockEnabled(): boolean {
  const v = process.env.ESPN_FIXTURES_DEV_MOCK?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Lookup a probe fixture by ESPN event id (offline fallback when live API fails). */
export function findEspnDevMockFixtureByEventId(
  eventId: string,
  leagueSlug?: string,
): FixtureRow | null {
  const rows = getEspnDevMockFixtures();
  const hit = rows.find((r) => r.id === eventId.trim());
  if (!hit) return null;
  if (leagueSlug && hit.sourceLeagueId && hit.sourceLeagueId !== leagueSlug) {
    return hit;
  }
  return hit;
}
