import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";

import { ScriptSlotForm } from "@/components/script-slot-form";
import { parseFixtureLeagueQuery, type MatchStatus } from "@/lib/fixtures-shared";
import { fetchFixtureByEventId } from "@/lib/thesportsdb-fixtures";
import { deriveSlotOutcomesFromScore } from "@/lib/script-slot-outcomes";

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

  const { home, away, league, kickoffUtc, status, homeScore, awayScore } = fixture;
  const kickoffMs = new Date(kickoffUtc).getTime();
  const canEditScripts =
    Number.isFinite(kickoffMs) &&
    kickoffMs > Date.now() &&
    status !== "finished" &&
    status !== "live";

  const hasLineScore =
    typeof homeScore === "number" &&
    typeof awayScore === "number" &&
    Number.isFinite(homeScore) &&
    Number.isFinite(awayScore);
  const slotActuals = hasLineScore
    ? deriveSlotOutcomesFromScore(homeScore, awayScore)
    : null;

  const matchFinished = status === "finished";
  const showBuildScript = !matchFinished;

  return (
    <div className="space-y-10">
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

      <header className="space-y-3">
        {hasLineScore ? (
          <h2 className="mt-0 text-[clamp(1.125rem,4vw,1.75rem)] font-semibold leading-snug tracking-tight text-[var(--foreground)]">
            <span className="text-[var(--team-text)]">{home}</span>{" "}
            <span className="tabular-nums text-[var(--muted)]">{homeScore}</span>
            <span className="mx-1.5 text-[var(--accent)]" aria-hidden>
              –
            </span>
            <span className="tabular-nums text-[var(--muted)]">{awayScore}</span>{" "}
            <span className="text-[var(--team-text)]">{away}</span>
          </h2>
        ) : (
          <h2 className="mt-0 text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">
            <span className="text-[var(--team-text)]">{home}</span>{" "}
            <span className="text-[var(--accent)]">vs</span>{" "}
            <span className="text-[var(--team-text)]">{away}</span>
          </h2>
        )}
        <p className="text-sm text-[var(--muted)]">{league}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span
            className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClass(status)}`}
          >
            {statusLabel(status)}
          </span>
          <span className="text-sm tabular-nums text-[var(--foreground)]">
            Kickoff (UTC): {formatKickoffUtc(kickoffUtc)}
          </span>
        </div>
      </header>

      {hasLineScore && slotActuals ? (
        <section aria-label="Script slot outcomes from the scoreline" className="space-y-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Script outcomes
          </h3>
          <dl className="grid max-w-sm grid-cols-[5.5rem_1fr] gap-x-6 gap-y-2.5 text-sm leading-snug">
            {slotActuals.map((row) => (
              <Fragment key={row.label}>
                <dt className="text-[var(--muted)]">{row.label}</dt>
                <dd className="font-semibold tabular-nums text-[var(--foreground)]">{row.actual}</dd>
              </Fragment>
            ))}
          </dl>
        </section>
      ) : null}

      {showBuildScript ? (
        <section className="border-t border-[var(--border)] pt-8">
          <ScriptSlotForm homeTeam={home} awayTeam={away} canEdit={canEditScripts} />
        </section>
      ) : null}
    </div>
  );
}
