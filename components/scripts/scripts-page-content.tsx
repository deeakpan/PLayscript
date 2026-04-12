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

export function ScriptsPageContent() {
  const env = getPlayscriptClientEnv();
  const { status } = useConnection();
  const connected = status === "connected";
  const q = usePlayscriptUserScripts();

  if (!env.ok) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Set{" "}
        <code className="rounded bg-[var(--surface)] px-1 text-xs">NEXT_PUBLIC_PLAYSCRIPT_CORE_ADDRESS</code>{" "}
        and PLAY token env to load scripts.
      </p>
    );
  }

  if (!connected) {
    return (
      <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
        <p className="text-sm text-[var(--muted)]">Connect a wallet to list scripts you have locked on-chain.</p>
        <ConnectWallet />
      </div>
    );
  }

  if (q.isPending || q.isFetching) {
    return <p className="text-sm text-[var(--muted)]">Loading your scripts…</p>;
  }

  if (q.isError) {
    return <p className="text-sm text-rose-300/90">Could not load scripts: {q.error.message}</p>;
  }

  const rows = q.data ?? [];
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No locked scripts for this wallet yet. Pick a match from the list and lock a script there.
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {rows.map((s) => {
        const sportKey = sportIndexToKey(s.sportIndex);
        const sportTitle = SCRIPT_SPORT_TITLES[sportKey];
        const title = cardTitle(s.homeTeam, s.awayTeam, s.eventId, s.matchId);
        const fixtureHref =
          s.eventId !== null
            ? buildFixtureDetailHref(s.eventId, ALL_LEAGUES_ID, s.sourceLeagueId)
            : null;

        const statusLabel = s.claimed
          ? "Claimed"
          : s.matchSettled
            ? "Settled"
            : "Pending";

        return (
          <li key={s.scriptId}>
            <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold tracking-tight text-[var(--foreground)]">{title}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {sportTitle}
                  <span className="text-[var(--border)]"> · </span>
                  match <span className="font-mono tabular-nums text-[var(--foreground)]/90">#{s.matchId}</span>
                  <span className="text-[var(--border)]"> · </span>
                  script <span className="font-mono tabular-nums text-[var(--foreground)]/90">{s.scriptId}</span>
                </p>
              </div>

              <div className="flex shrink-0 flex-row items-center justify-between gap-3 border-t border-[var(--border)]/80 pt-3 sm:border-t-0 sm:pt-0">
                <div>
                  <p className="font-mono text-sm font-semibold tabular-nums text-[var(--accent)]">
                    {s.stakeFormatted} $PLAY
                  </p>
                  <p className="text-[11px] text-[var(--muted)]">{statusLabel}</p>
                </div>
                {fixtureHref ? (
                  <Link
                    href={fixtureHref}
                    className="rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--background)] transition-[filter] hover:brightness-110"
                  >
                    Open
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
