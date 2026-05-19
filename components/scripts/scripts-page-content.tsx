"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useConnection } from "wagmi";

import {
  playscriptV2SubgraphConfigured,
  usePlayscriptV2UserScripts,
  type V2UserScriptListRow,
} from "@/hooks/use-playscript-v2-user-scripts";
import { playscriptV2LockRegistryConfigured } from "@/lib/playscript-public-env";
import { playscriptV2SubgraphIndexingMessage } from "@/lib/playscript-v2-subgraph";
import { usePlayscriptUserScripts, type UserScriptListRow } from "@/hooks/use-playscript-user-scripts";
import { ALL_LEAGUES_ID, buildFixtureDetailHref } from "@/lib/fixtures-shared";
import { getPlayscriptClientEnv } from "@/lib/playscript-public-env";
import { sportIndexToKey } from "@/lib/playscript-unpack-picks";
import { formatUnits } from "viem";
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

function v2PayoutDisplay(s: V2UserScriptListRow): { label: string; amount: string } {
  if (s.claimed && s.payoutFormatted) {
    return { label: "Payout", amount: s.payoutFormatted };
  }
  const wei = (BigInt(s.netStake) * BigInt(s.payoutRate)) / BigInt(10);
  return { label: "Potential payout", amount: formatUnits(wei, 18) };
}

function ScriptStakeFooter({
  stakeAmount,
  payoutLabel,
  payoutAmount,
}: {
  stakeAmount: string;
  payoutLabel: string;
  payoutAmount: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Stake</p>
        <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[var(--accent)]">
          {stakeAmount} PLAY
        </p>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          {payoutLabel}
        </p>
        <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-emerald-300/95">
          {payoutAmount} PLAY
        </p>
      </div>
    </div>
  );
}

const cardClassName =
  "block overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,box-shadow] hover:border-[var(--accent)]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

function ScriptCardShell({
  fixtureHref,
  cardKey,
  title,
  sportTitle,
  statusLabel,
  claimed,
  matchSettled,
  footer,
}: {
  fixtureHref: string | null;
  cardKey: string;
  title: string;
  sportTitle: string;
  statusLabel: string;
  claimed: boolean;
  matchSettled: boolean;
  footer: ReactNode;
}) {
  const inner = (
    <>
      <ScriptCardHeader
        title={title}
        sportTitle={sportTitle}
        statusLabel={statusLabel}
        claimed={claimed}
        matchSettled={matchSettled}
      />
      <div className="grid gap-3 border-t border-[var(--border)]/80 px-4 py-3">{footer}</div>
    </>
  );

  return (
    <li key={cardKey}>
      {fixtureHref ? (
        <Link href={fixtureHref} className={cardClassName}>
          {inner}
        </Link>
      ) : (
        <article className={cardClassName}>{inner}</article>
      )}
    </li>
  );
}

function ScriptCardHeader({
  title,
  sportTitle,
  statusLabel,
  claimed,
  matchSettled,
}: {
  title: string;
  sportTitle: string;
  statusLabel: string;
  claimed: boolean;
  matchSettled: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold tracking-tight text-[var(--foreground)]">{title}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{sportTitle}</p>
      </div>
      <span
        className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusClass(
          claimed,
          matchSettled,
        )}`}
      >
        {statusLabel}
      </span>
    </div>
  );
}

function ScriptsV1List({ rows }: { rows: UserScriptListRow[] }) {
  return (
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

        return (
          <ScriptCardShell
            key={s.scriptId}
            cardKey={s.scriptId}
            fixtureHref={fixtureHref}
            title={title}
            sportTitle={sportTitle}
            statusLabel={statusLabel}
            claimed={s.claimed}
            matchSettled={s.matchSettled}
            footer={
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Stake
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[var(--accent)]">
                  {s.stakeFormatted} PLAY
                </p>
              </div>
            }
          />
        );
      })}
    </ul>
  );
}

function ScriptsV2List({ rows }: { rows: V2UserScriptListRow[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((s) => {
        const sportKey = sportIndexToKey(s.sportIndex);
        const sportTitle = SCRIPT_SPORT_TITLES[sportKey];
        const title = cardTitle(s.homeTeam, s.awayTeam, s.eventId, s.matchId);
        const fixtureHref =
          s.eventId !== null
            ? buildFixtureDetailHref(s.eventId, ALL_LEAGUES_ID, s.sourceLeagueId)
            : null;
        const statusLabel = s.claimed ? "Claimed" : s.matchSettled ? "Settled" : "Open";
        const payout = v2PayoutDisplay(s);

        return (
          <ScriptCardShell
            key={s.lockId}
            cardKey={s.lockId}
            fixtureHref={fixtureHref}
            title={title}
            sportTitle={sportTitle}
            statusLabel={statusLabel}
            claimed={s.claimed}
            matchSettled={s.matchSettled}
            footer={
              <ScriptStakeFooter
                stakeAmount={s.netStakeFormatted}
                payoutLabel={payout.label}
                payoutAmount={payout.amount}
              />
            }
          />
        );
      })}
    </ul>
  );
}

function LoadingSpinner() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)]/80 bg-[var(--surface)]/50 px-3 py-1.5 text-xs text-[var(--muted)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]/80 animate-pulse [animation-delay:160ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]/60 animate-pulse [animation-delay:320ms]" />
      <span className="ml-1">Loading scripts</span>
    </div>
  );
}

export function ScriptsPageContent() {
  const useV2 = playscriptV2SubgraphConfigured() || playscriptV2LockRegistryConfigured();
  const v1Env = getPlayscriptClientEnv();
  const { status } = useConnection();
  const connected = status === "connected";
  const v1Q = usePlayscriptUserScripts({ enabled: !useV2 });
  const v2Q = usePlayscriptV2UserScripts();
  const q = useV2 ? v2Q : v1Q;
  const v2Indexing = useV2 && v2Q.data?.indexing === true;

  if (!useV2 && !v1Env.ok) {
    return (
      <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 sm:p-5">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">My Scripts</h1>
        <p className="text-sm text-[var(--muted)]">
          Set{" "}
          <code className="rounded bg-[var(--surface)] px-1 text-xs">NEXT_PUBLIC_PLAYSCRIPT_V2_LOCK_REGISTRY_ADDRESS</code>{" "}
          (or subgraph URL) for v2 history, or v1{" "}
          <code className="rounded bg-[var(--surface)] px-1 text-xs">NEXT_PUBLIC_PLAYSCRIPT_CORE_ADDRESS</code>.
        </p>
      </section>
    );
  }

  if (!connected) {
    return (
      <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 sm:p-6">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">My Scripts</h1>
        <p className="text-sm text-[var(--muted)]">Connect a wallet to list scripts you have locked onchain.</p>
        <ConnectWallet />
      </section>
    );
  }

  const showInitialLoad = useV2
    ? v2Q.isPending || (v2Q.isFetching && v2Q.data == null)
    : q.isPending || (q.isFetching && q.data == null);

  if (showInitialLoad) {
    return (
      <section className="space-y-3">
        <h1 className="font-[family-name:var(--font-syne),ui-sans-serif,sans-serif] text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
          My Scripts
        </h1>
        <LoadingSpinner />
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

  const rows = useV2 ? (v2Q.data?.scripts ?? []) : (v1Q.data ?? []);
  if (v2Indexing) {
    return (
      <section className="space-y-3 rounded-xl border border-amber-400/25 bg-amber-500/5 p-4 sm:p-5">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">My Scripts</h1>
        <p className="text-sm text-amber-200/90">{playscriptV2SubgraphIndexingMessage}</p>
        <LoadingSpinner />
      </section>
    );
  }

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
        <p className="text-sm text-[var(--muted)] sm:text-base">
          Tap a match for picks and actions.
        </p>
      </div>
      {useV2 ? <ScriptsV2List rows={rows as V2UserScriptListRow[]} /> : <ScriptsV1List rows={rows as UserScriptListRow[]} />}
    </section>
  );
}
