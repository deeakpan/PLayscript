"use client";

import Link from "next/link";
import { useConnection } from "wagmi";

import { usePlayscriptUserScripts } from "@/hooks/use-playscript-user-scripts";
import { ALL_LEAGUES_ID, buildFixtureDetailHref } from "@/lib/fixtures-shared";
import { getPlayscriptClientEnv } from "@/lib/playscript-public-env";
import { sportIndexToKey } from "@/lib/playscript-unpack-picks";
import { SCRIPT_SPORT_TITLES } from "@/lib/script-slots";

import { ConnectWallet } from "@/components/web3/connect-wallet";

function cardTitle(home: string, away: string, eventId: string | null, matchId: string): string {
  const h = home.trim();
  const a = away.trim();
  if (h && a) return `${h} vs ${a}`;
  if (h || a) return `${h}${h && a ? " vs " : ""}${a}`.trim() || fallbackTitle(eventId, matchId);
  return fallbackTitle(eventId, matchId);
}

function fallbackTitle(eventId: string | null, matchId: string): string {
  if (eventId) return `Event #${eventId}`;
  return `Match #${matchId}`;
}

function statusClass(claimed: boolean, matchSettled: boolean): string {
  if (claimed) return "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25";
  if (matchSettled) return "bg-sky-500/15 text-sky-200 ring-sky-500/25";
  return "bg-amber-500/15 text-amber-200 ring-amber-500/25";
}

export function ScriptsPageContent() {
  const env = getPlayscriptClientEnv();
  const { status } = useConnection();
  const connected = status === "connected";
  const q = usePlayscriptUserScripts();

  if (!env.ok) {
    return (
      <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 sm:p-5">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">My Scripts</h1>
        <p className="text-sm text-[var(--muted)]">
          Set{" "}
          <code className="rounded bg-[var(--surface)] px-1 text-xs">
            NEXT_PUBLIC_PLAYSCRIPT_CORE_ADDRESS
          </code>{" "}
          and PLAY token env to load scripts.
        </p>
      </section>
    );
  }

  if (!connected) {
    return (
      <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 sm:p-6">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">My Scripts</h1>
        <p className="text-sm text-[var(--muted)]">
          Connect a wallet to list scripts you have locked on-chain.
        </p>
        <ConnectWallet />
      </section>
    );
  }

  if (q.isPending || q.isFetching) {
    return (
      <section className="space-y-3">
        <h1 className="font-[family-name:var(--font-syne),ui-sans-serif,sans-serif] text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
          My Scripts
        </h1>
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)]/80 bg-[var(--surface)]/50 px-3 py-1.5 text-xs text-[var(--muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]/80 animate-pulse [animation-delay:160ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]/60 animate-pulse [animation-delay:320ms]" />
          <span className="ml-1">Loading scripts</span>
        </div>
      </section>
    );
  }

  if (q.isError) {
    return (
      <section className="space-y-3 rounded-xl border border-rose-400/30 bg-rose-500/5 p-4 sm:p-5">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">My Scripts</h1>
        <p className="text-sm text-rose-300/90">Could not load scripts: {q.error.message}</p>
      </section>
    );
  }

  const rows = q.data ?? [];
  if (rows.length === 0) {
    return (
      <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 sm:p-5">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">My Scripts</h1>
        <p className="text-sm text-[var(--muted)]">
          No locked scripts for this wallet yet. Pick a match from the list and lock a script there.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-[family-name:var(--font-syne),ui-sans-serif,sans-serif] text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
          My Scripts
        </h1>
        <p className="font-[family-name:var(--font-syne),ui-sans-serif,sans-serif] text-base text-[var(--muted)] sm:text-lg">
          Review your locked scripts, stake amount, and settlement status.
        </p>
      </div>

      <ul className="space-y-3">
        {rows.map((s) => {
          const sportKey = sportIndexToKey(s.sportIndex);
          const sportTitle = SCRIPT_SPORT_TITLES[sportKey];
          const title = cardTitle(s.homeTeam, s.awayTeam, s.eventId, s.matchId);
          const fixtureHref =
            s.eventId !== null
              ? buildFixtureDetailHref(s.eventId, ALL_LEAGUES_ID, s.sourceLeagueId)
              : null;

          const statusLabel = s.claimed ? "Claimed" : s.matchSettled ? "Settled" : "Pending";

          const cardClassName =
            "block overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,box-shadow] hover:border-[var(--accent)]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

          const cardInner = (
            <>
                <div className="flex items-start justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold tracking-tight text-[var(--foreground)]">
                      {title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {sportTitle}
                      <span className="text-[var(--border)]"> · </span>
                      match{" "}
                      <span className="font-mono tabular-nums text-[var(--foreground)]/90">#{s.matchId}</span>
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusClass(
                      s.claimed,
                      s.matchSettled,
                    )}`}
                  >
                    {statusLabel}
                  </span>
                </div>

                <div className="grid gap-3 border-t border-[var(--border)]/80 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                    <span>
                      stake{" "}
                      <span className="font-mono font-semibold tabular-nums text-[var(--accent)]">
                        {s.stakeFormatted} $PLAY
                      </span>
                    </span>
                    <span className="hidden sm:inline text-[var(--border)]">·</span>
                    <span>
                      script{" "}
                      <span className="font-mono tabular-nums text-[var(--foreground)]/90">{s.scriptId}</span>
                    </span>
                  </div>
                </div>
            </>
          );

          return (
            <li key={s.scriptId}>
              {fixtureHref ? (
                <Link href={fixtureHref} className={cardClassName}>
                  {cardInner}
                </Link>
              ) : (
                <article className={cardClassName}>{cardInner}</article>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
