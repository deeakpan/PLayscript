import { notFound } from "next/navigation";

import { FixtureDetailView } from "@/components/fixtures/fixture-detail-view";
import { parseFixtureLeagueQuery } from "@/lib/fixtures-shared";
import { buildLookupeventApiUrl } from "@/lib/thesportsdb-url-public";
import { fetchFixtureByEventId } from "@/lib/thesportsdb-fixtures";

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
  const fixture = await fetchFixtureByEventId(eventId, { leagueId: leagueHint });
  if (!fixture) notFound();

  const lookupeventUrl = buildLookupeventApiUrl(eventId);

  return <FixtureDetailView fixture={fixture} lookupeventUrl={lookupeventUrl} />;
}
