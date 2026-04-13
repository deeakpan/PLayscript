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

function ChoicesReceiptInline({ full }: { full: string }) {
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
      title="Copy full receipt"
      className="font-mono text-[11px] text-[var(--muted)] underline-offset-2 transition-colors hover:text-[var(--dream-yellow)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)]"
    >
      {copied ? "Copied" : abbreviateReceipt(full)}
    </button>
  );
}

export function FixtureExistingScriptCard({ payload }: { payload: LockedPayload }) {
  const { script, matchSettled, settlement, sportIndex } = payload;
  const sportTitle = SCRIPT_SPORT_TITLES[sportIndexToKey(sportIndex)];
  const windowOpen = settlement.settlementWindowOpen;
  const showSettlingNotice = windowOpen && !matchSettled;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)]/40 px-3 py-2 sm:px-4">
        <div>
          <p className="text-[10px] text-[var(--muted)]">
            <span className="font-semibold uppercase tracking-[0.18em]">Your locked script</span>
            <span className="mx-1.5 font-normal">·</span>
            <span className="font-medium normal-case tracking-normal text-[var(--foreground)]">
              {sportTitle}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">Stake</p>
          <p className="font-mono text-sm font-semibold tabular-nums text-[var(--accent)]">
            {script.stakeFormatted} PLAY
          </p>
        </div>
      </div>

      <div className="space-y-3 px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
          <span>
            Receipt <ChoicesReceiptInline full={script.choicesReceipt} />
          </span>
          <span className="hidden sm:inline">·</span>
          <span>{script.claimed ? "Payout claimed" : "Payout not claimed"}</span>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Picks</p>
          <ul className="mt-1.5 divide-y divide-[var(--border)]/70 border border-[var(--border)]/60 rounded-lg overflow-hidden">
            {script.slotPicks.map((row) => (
              <li
                key={row.label}
                className="flex items-baseline justify-between gap-2 px-2 py-1.5 text-xs"
              >
                <span className="shrink-0 text-[var(--muted)]">{row.label}</span>
                <span className="text-right font-medium text-[var(--foreground)]">{row.value}</span>
              </li>
            ))}
          </ul>
        </div>

        {showSettlingNotice ? (
          <div className="rounded-lg border border-[var(--border)]/80 bg-[var(--surface)]/30 px-2.5 py-2">
            <p className="text-xs leading-snug text-[var(--muted)]">
              Kickoff + finalize delay has passed; final scores are still settling onchain. This card
              refreshes automatically.
            </p>
          </div>
        ) : null}

        <p className="text-[10px] leading-relaxed text-[var(--muted)]">
          One script per wallet per match. Builder stays hidden so you do not lock twice by mistake.
        </p>
      </div>
    </div>
  );
}
