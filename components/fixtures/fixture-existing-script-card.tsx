"use client";

import { useCallback, useState } from "react";

import type { UserScriptOkResponse } from "@/hooks/use-playscript-user-script";
import { sportIndexToKey } from "@/lib/playscript-unpack-picks";
import { SCRIPT_SPORT_TITLES } from "@/lib/script-slots";

type LockedPayload = Extract<UserScriptOkResponse, { hasScript: true }>;

function abbreviateReceipt(hex: string): string {
  const h = hex.trim();
  if (h.length <= 16) return h;
  return `${h.slice(0, 10)}…${h.slice(-8)}`;
}

function ChoicesReceiptCopy({ full }: { full: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [full]);

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      title="Click to copy full receipt"
      className="group w-full rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-[var(--border)] hover:bg-[var(--surface)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
    >
      <span className="font-mono text-xs text-[var(--foreground)] group-hover:text-[var(--dream-yellow)]">
        {abbreviateReceipt(full)}
      </span>
      <span className="mt-0.5 block text-[10px] text-[var(--muted)]">
        {copied ? "Copied." : "Click to copy full hash"}
      </span>
    </button>
  );
}

export function FixtureExistingScriptCard({
  matchIdDisplay,
  payload,
}: {
  matchIdDisplay: string;
  payload: LockedPayload;
}) {
  const { script, matchSettled, sportIndex } = payload;
  const sportKey = sportIndexToKey(sportIndex);
  const sportTitle = SCRIPT_SPORT_TITLES[sportKey];

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface)]/50 px-4 py-3 sm:px-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Your locked script
        </p>
        <p className="mt-1 text-sm text-[var(--foreground)]">
          Match <span className="font-mono tabular-nums">#{matchIdDisplay}</span>
          <span className="text-[var(--muted)]"> · </span>
          {sportTitle}
        </p>
      </div>

      <div className="space-y-4 px-4 py-5 sm:px-5">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium text-[var(--muted)]">Script ID</dt>
            <dd className="font-mono text-[var(--foreground)]">{script.scriptId}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium text-[var(--muted)]">Stake</dt>
            <dd className="font-mono font-semibold tabular-nums text-[var(--accent)]">
              {script.stakeFormatted} PLAY
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:col-span-2">
            <dt className="text-xs font-medium text-[var(--muted)]">Choices receipt</dt>
            <dd>
              <ChoicesReceiptCopy full={script.choicesReceipt} />
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium text-[var(--muted)]">Payout claimed</dt>
            <dd className="text-[var(--foreground)]">{script.claimed ? "Yes" : "No"}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium text-[var(--muted)]">Match settled</dt>
            <dd className="text-[var(--foreground)]">{matchSettled ? "Yes" : "No"}</dd>
          </div>
        </dl>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Your picks</p>
          <ul className="mt-3 space-y-2.5">
            {script.slotPicks.map((row) => (
              <li
                key={row.label}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--border)]/60 pb-2.5 last:border-b-0 last:pb-0"
              >
                <span className="text-[var(--muted)]">{row.label}</span>
                <span className="font-medium text-[var(--foreground)]">{row.value}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs leading-relaxed text-[var(--muted)]">
          You already locked a script for this match. PlayscriptCore allows one stake per address per
          match for this flow — build is hidden so you do not submit a duplicate by mistake.
        </p>
      </div>
    </div>
  );
}
