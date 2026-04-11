import Link from "next/link";
import { notFound } from "next/navigation";

import { ScriptSlotForm } from "@/components/script-slot-form";
import {
  fetchFixtureByEventId,
  parseFixtureLeagueQuery,
} from "@/lib/thesportsdb-fixtures";
import type { MatchStatus } from "@/lib/thesportsdb-fixtures";

function statusLabel(s: MatchStatus): string {
  switch (s) {
    case "open":
      return "Scheduled";
    case "closing_soon":
      return "Postponed";
    case "live":
      return "Live";
    case "finished":
      return "Finished";
    default:
      return s;
  }
}

function statusClass(s: MatchStatus): string {
  switch (s) {
    case "open":
      return "bg-zinc-500/15 text-zinc-200 ring-zinc-500/25";
    case "closing_soon":
      return "bg-amber-500/12 text-amber-200/90 ring-amber-500/20";
    case "live":
      return "bg-rose-500/12 text-rose-200/90 ring-rose-500/20";
    case "finished":
      return "bg-zinc-500/15 text-zinc-300 ring-zinc-500/20";
    default:
      return "";
  }
}

function formatKickoffUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(d);
}

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

  const { home, away, league, kickoffUtc, status } = fixture;
  const kickoffMs = new Date(kickoffUtc).getTime();
  const canEditScripts =
    Number.isFinite(kickoffMs) &&
    kickoffMs > Date.now() &&
    status !== "finished" &&
    status !== "live";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="text-xs font-medium uppercase tracking-wider text-[var(--muted)] underline-offset-4 hover:text-[var(--foreground)] hover:underline"
        >
          ← Upcoming fixtures
        </Link>
        <Link
          href="/how-it-works"
          className="text-xs font-medium text-[var(--muted)] underline-offset-4 transition-colors hover:text-[var(--dream-yellow)] hover:underline"
        >
          How it works
        </Link>
      </div>
      <div>
        <h2 className="mt-0 text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">
          <span className="text-[var(--team-text)]">{home}</span>{" "}
          <span className="text-[var(--accent)]">vs</span>{" "}
          <span className="text-[var(--team-text)]">{away}</span>
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{league}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClass(status)}`}
          >
            {statusLabel(status)}
          </span>
          <span className="text-sm tabular-nums text-[var(--foreground)]">
            Kickoff (UTC): {formatKickoffUtc(kickoffUtc)}
          </span>
        </div>
      </div>

      <section>
        <ScriptSlotForm homeTeam={home} awayTeam={away} canEdit={canEditScripts} />
      </section>
    </div>
  );
}
