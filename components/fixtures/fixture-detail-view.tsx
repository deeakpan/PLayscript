"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";

import { FixtureClaimPayoutModal } from "@/components/fixtures/fixture-claim-payout-modal";
import { FixtureKickoffEta } from "@/components/fixtures/fixture-kickoff-eta";
import { FixturePlayscriptSection } from "@/components/fixtures/fixture-playscript-section";
import { deriveDisplayMatchStatus } from "@/lib/fixture-display-status";
import type { FixtureRow, MatchStatus } from "@/lib/fixtures-shared";
import { usePlayscriptMatchByUrl } from "@/hooks/use-playscript-match-by-url";
import { usePlayscriptUserScript } from "@/hooks/use-playscript-user-script";
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

type Props = {
  fixture: FixtureRow;
  lookupeventUrl: string;
};

export function FixtureDetailView({ fixture, lookupeventUrl }: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [claimModalOpen, setClaimModalOpen] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const { home, away, league, kickoffUtc, status, homeScore, awayScore, statusDetail } = fixture;
  const kickoffMs = new Date(kickoffUtc).getTime();
  const displayStatus = deriveDisplayMatchStatus(status, kickoffMs, nowMs, fixture.sportKey);

  const kickoffOpen = Number.isFinite(kickoffMs) && kickoffMs > nowMs;
  const canEditScripts =
    kickoffOpen && displayStatus !== "finished" && displayStatus !== "live";

  const hasLineScore =
    typeof homeScore === "number" &&
    typeof awayScore === "number" &&
    Number.isFinite(homeScore) &&
    Number.isFinite(awayScore);
  const slotActuals = hasLineScore
    ? deriveSlotOutcomesFromScore(homeScore, awayScore, fixture.sportKey)
    : null;

  const showScriptOutcomesBlock =
    displayStatus !== "live" && hasLineScore && slotActuals !== null && slotActuals.length > 0;
  const showLiveStatsBlock = displayStatus === "live";

  const matchByUrl = usePlayscriptMatchByUrl(lookupeventUrl);
  const resolvedMatchId =
    matchByUrl.data?.matchId !== null && matchByUrl.data?.matchId !== undefined
      ? Number(matchByUrl.data.matchId)
      : null;
  const userScriptQ = usePlayscriptUserScript(resolvedMatchId);
  const outcomeGrading =
    userScriptQ.data?.hasScript === true &&
    userScriptQ.data.matchSettled &&
    userScriptQ.data.grading
      ? userScriptQ.data.grading
      : null;
  const showOutcomeTicks =
    Boolean(outcomeGrading) &&
    slotActuals !== null &&
    outcomeGrading!.rows.length === slotActuals.length;

  const claimModalData = useMemo(() => {
    const d = userScriptQ.data;
    if (!d || d.hasScript !== true || !d.matchSettled || !d.claim) return null;
    return {
      scriptId: d.script.scriptId,
      stakeFormatted: d.script.stakeFormatted,
      stakeWei: d.script.stake,
      decimals: d.script.decimals,
      claimed: d.script.claimed,
      claim: d.claim,
    };
  }, [userScriptQ.data]);

  useEffect(() => {
    if (!claimModalData) setClaimModalOpen(false);
  }, [claimModalData]);

  const showKickoffCountdown =
    displayStatus === "open" && Number.isFinite(kickoffMs) && kickoffMs > nowMs;

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
            className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClass(displayStatus)}`}
          >
            {statusLabel(displayStatus)}
          </span>
          <span className="text-sm tabular-nums text-[var(--foreground)]">
            Kickoff (UTC): {formatKickoffUtc(kickoffUtc)}
          </span>
        </div>
        {showKickoffCountdown ? <FixtureKickoffEta kickoffUtc={kickoffUtc} /> : null}
      </header>

      {showLiveStatsBlock ? (
        <section aria-label="Live match stats" className="space-y-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Live stats
          </h3>
          <div className="max-w-md space-y-3 text-sm">
            {hasLineScore ? (
              <p className="tabular-nums text-[var(--foreground)]">
                <span className="text-[var(--team-text)]">{home}</span>{" "}
                <span className="font-semibold">{homeScore}</span>
                <span className="mx-2 text-[var(--muted)]">–</span>
                <span className="font-semibold">{awayScore}</span>{" "}
                <span className="text-[var(--team-text)]">{away}</span>
              </p>
            ) : (
              <p className="text-[var(--muted)]">Score line not in the feed yet — check back shortly.</p>
            )}
            {statusDetail ? (
              <p>
                <span className="text-[var(--muted)]">Period / status: </span>
                <span className="font-medium text-[var(--foreground)]">{statusDetail}</span>
              </p>
            ) : null}
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              Script slot outcomes are hidden while the match is live. Settlement uses the on-chain
              window after kickoff + finalize delay.
            </p>
          </div>
        </section>
      ) : null}

      {showScriptOutcomesBlock ? (
        <section aria-label="Script slot outcomes from the scoreline">
          <div className="flex max-w-xl min-w-0 flex-row flex-wrap items-center gap-x-8 gap-y-3 sm:gap-x-10">
            <div className="min-w-0 max-w-sm flex-1 space-y-2.5">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Script outcomes
              </h3>
              <dl
                className={`grid gap-x-4 gap-y-2.5 text-sm leading-snug ${
                  showOutcomeTicks ? "grid-cols-[5.5rem_1fr_1.25rem]" : "grid-cols-[5.5rem_1fr]"
                }`}
              >
                {slotActuals!.map((row, i) => {
                  const tick = showOutcomeTicks && outcomeGrading ? outcomeGrading.rows[i] : undefined;
                  return (
                    <Fragment key={`${row.label}-${i}`}>
                      <dt className="text-[var(--muted)]">{row.label}</dt>
                      <dd className="font-semibold tabular-nums text-[var(--foreground)]">{row.actual}</dd>
                      {showOutcomeTicks && tick ? (
                        <dd className="flex items-center justify-center">
                          <span
                            className={`text-base font-bold ${
                              tick.correct ? "text-emerald-400" : "text-zinc-600"
                            }`}
                            aria-label={tick.correct ? "Correct" : "Incorrect"}
                          >
                            {tick.correct ? "✓" : "✗"}
                          </span>
                        </dd>
                      ) : null}
                    </Fragment>
                  );
                })}
              </dl>
              {outcomeGrading ? (
                <p className="text-[10px] tabular-nums text-[var(--muted)]">
                  On-chain final {outcomeGrading.finalHome}–{outcomeGrading.finalAway}
                </p>
              ) : null}
            </div>
            {outcomeGrading ? (
              <div className="flex shrink-0 flex-col items-end pl-8 text-right sm:pl-14 lg:pl-20">
                <p
                  className={`font-black tabular-nums tracking-tight ${
                    outcomeGrading.correctSlots >= 4
                      ? "text-6xl text-emerald-400 sm:text-7xl"
                      : outcomeGrading.correctSlots >= 3
                        ? "text-6xl text-emerald-400/90 sm:text-7xl"
                        : "text-6xl text-zinc-400 sm:text-7xl"
                  }`}
                >
                  {outcomeGrading.correctSlots}
                  <span className="text-4xl font-bold text-zinc-500 sm:text-5xl">/5</span>
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 sm:text-sm">
                  correct
                </p>
                {claimModalData ? (
                  <>
                    <button
                      type="button"
                      disabled={claimModalData.claimed}
                      onClick={() => {
                        if (!claimModalData.claimed) setClaimModalOpen(true);
                      }}
                      className="mt-3 w-full min-w-[7.5rem] max-w-[10rem] rounded-lg border border-[var(--border)] bg-[var(--surface-active)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] enabled:hover:border-[var(--accent)]/40 enabled:hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:border-[var(--border)]/70 disabled:bg-[var(--surface)]/40 disabled:text-[var(--muted)] disabled:opacity-80 disabled:shadow-none disabled:hover:bg-[var(--surface)]/40"
                    >
                      {claimModalData.claimed ? "Claimed" : "Claim"}
                    </button>
                    <FixtureClaimPayoutModal
                      open={claimModalOpen}
                      onClose={() => setClaimModalOpen(false)}
                      scriptId={claimModalData.scriptId}
                      stakeFormatted={claimModalData.stakeFormatted}
                      stakeWei={claimModalData.stakeWei}
                      decimals={claimModalData.decimals}
                      claimed={claimModalData.claimed}
                      claim={claimModalData.claim}
                    />
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <FixturePlayscriptSection
        lookupeventUrl={lookupeventUrl}
        homeTeam={home}
        awayTeam={away}
        canEdit={canEditScripts}
        kickoffOpen={kickoffOpen}
        sportKey={fixture.sportKey}
      />
    </div>
  );
}
