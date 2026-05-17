import { notFound } from "next/navigation";

import { FixtureDetailView } from "@/components/fixtures/fixture-detail-view";
import { FixtureEspnUnavailable } from "@/components/fixtures/fixture-espn-unavailable";
import { parseFixtureLeagueQuery, UPCOMING_LEAGUES } from "@/lib/fixtures-shared";
import { isEspnNetworkError } from "@/lib/espn-fetch";
import { fetchEspnFixtureByEventId } from "@/lib/espn-fixtures";
import { buildV2EspnRegisterUrls } from "@/lib/playscript-v2-register-args";

export default async function FixturePage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ league?: string | string[] }>;
}) {
  const { eventId: raw } = await params;
  const eventId = decodeURIComponent(raw);
  const sp = await searchParams;
  const leagueHint = parseFixtureLeagueQuery(sp.league);
  const leagueSlug =
    leagueHint ?? UPCOMING_LEAGUES.find((l) => l.sportKey === "soccer")?.id ?? "soccer/eng.1";

  let fixture;
  try {
    fixture = await fetchEspnFixtureByEventId(leagueSlug, eventId);
  } catch (e) {
    if (isEspnNetworkError(e)) {
      return (
        <FixtureEspnUnavailable
          eventId={eventId}
          message={e instanceof Error ? e.message : "Cannot reach site.api.espn.com"}
        />
      );
    }
    throw e;
  }
  if (!fixture) notFound();

  const { url: matchUrl } = buildV2EspnRegisterUrls(
    fixture.sourceLeagueId ?? leagueSlug,
    fixture.id,
    fixture.sportKey,
  );

  return <FixtureDetailView fixture={fixture} lookupeventUrl={matchUrl} />;
}
