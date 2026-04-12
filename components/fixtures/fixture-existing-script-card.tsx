"use client";

import { useCallback, useState } from "react";

import type { UserScriptOkResponse } from "@/hooks/use-playscript-user-script";
import { sportIndexToKey } from "@/lib/playscript-unpack-picks";
import { SCRIPT_SPORT_TITLES } from "@/lib/script-slots";

import { PlayscriptClaimPayoutButton } from "@/components/playscript-claim-payout-button";

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

export function FixtureExistingScriptCard({
  matchIdDisplay,
  payload,
}: {
  matchIdDisplay: string;
  payload: LockedPayload;
}) {
  const { script, matchSettled, sportIndex, settlement, grading, claim } = payload;
  const sportKey = sportIndexToKey(sportIndex);
  const sportTitle = SCRIPT_SPORT_TITLES[sportKey];
  const windowOpen = settlement.settlementWindowOpen;
  const showSettlingNotice = windowOpen && !matchSettled;
  const showGrading = Boolean(grading && matchSettled);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)]/40 px-3 py-2 sm:px-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Your locked script
          </p>
          <p className="text-xs text-[var(--foreground)]">
            #{matchIdDisplay}
            <span className="text-[var(--muted)]"> · </span>
            {sportTitle}
            <span className="text-[var(--muted)]"> · </span>
            <span className="font-mono text-[var(--muted)]">id {script.scriptId}</span>
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
              <li key={row.label} className="flex items-baseline justify-between gap-2 px-2 py-1.5 text-xs">
                <span className="text-[var(--muted)] shrink-0">{row.label}</span>
                <span className="font-medium text-[var(--foreground)] text-right">{row.value}</span>
              </li>
            ))}
          </ul>
        </div>

        {showSettlingNotice ? (
          <div className="rounded-lg border border-[var(--border)]/80 bg-[var(--surface)]/30 px-2.5 py-2">
            <p className="text-xs leading-snug text-[var(--muted)]">
              Kickoff + finalize delay has passed; final scores are still settling on-chain. This card
              refreshes automatically.
            </p>
          </div>
        ) : null}

        {showGrading && grading ? (
          <div className="rounded-lg border border-[var(--border)]/80 bg-[var(--surface)]/30 px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Grading vs final ({grading.finalHome}–{grading.finalAway})
            </p>
            <p className="mt-2 flex items-baseline gap-2">
              <span
                className={`font-black tabular-nums tracking-tight ${
                  grading.correctSlots >= 4
                    ? "text-3xl text-emerald-400 sm:text-4xl"
                    : grading.correctSlots >= 3
                      ? "text-3xl text-emerald-400/90 sm:text-4xl"
                      : "text-3xl text-zinc-400 sm:text-4xl"
                }`}
              >
                {grading.correctSlots}
                <span className="text-lg font-bold text-zinc-500 sm:text-xl">/5</span>
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                correct
              </span>
            </p>
            <ul className="mt-3 space-y-2">
              {grading.rows.map((r) => (
                <li
                  key={r.label}
                  className="flex items-stretch gap-3 rounded-lg border border-[var(--border)]/50 bg-black/20 px-2 py-2 sm:gap-4 sm:px-3"
                >
                  <div
                    className={`flex w-11 shrink-0 select-none items-center justify-center rounded-md font-black leading-none sm:w-14 ${
                      r.correct
                        ? "bg-emerald-500/15 text-2xl text-emerald-400 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.35)] sm:text-3xl"
                        : "bg-zinc-800/80 text-2xl text-zinc-500 sm:text-3xl"
                    }`}
                    aria-hidden
                  >
                    {r.correct ? "✓" : "✗"}
                  </div>
                  <div className="min-w-0 flex-1 py-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      {r.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-snug text-zinc-100 sm:text-base">
                      <span className="text-zinc-100">{r.yourPick}</span>
                      <span className="mx-1.5 font-normal text-zinc-500">→</span>
                      <span className="text-zinc-100">{r.result}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {claim ? (
              <div className="mt-3 border-t border-[var(--border)]/70 pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  On claim (contract)
                </p>
                <ul className="mt-1 space-y-0.5 text-[11px] text-[var(--foreground)]">
                  <li>
                    <span className="text-[var(--muted)]">Tier: </span>
                    {claim.tierLabel}
                  </li>
                  {claim.winner ? (
                    <>
                      <li>
                        <span className="text-[var(--muted)]">Minted to you: </span>
                        <span className="font-mono tabular-nums">{claim.mintUserFormatted} PLAY</span>
                      </li>
                      <li>
                        <span className="text-[var(--muted)]">Mint fee (treasury): </span>
                        <span className="font-mono tabular-nums">{claim.mintFeeFormatted} PLAY</span>
                      </li>
                    </>
                  ) : (
                    <li className="text-[var(--muted)]">No PLAY mint below 3/5 correct.</li>
                  )}
                  <li>
                    <span className="text-[var(--muted)]">Stake ({script.stakeFormatted} PLAY): </span>
                    sent to treasury (full stake on every claim)
                  </li>
                </ul>
                {claim.showClaimButton ? (
                  <PlayscriptClaimPayoutButton scriptId={script.scriptId} />
                ) : script.claimed ? (
                  <p className="mt-2 text-[11px] text-[var(--muted)]">Already claimed.</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="text-[10px] leading-relaxed text-[var(--muted)]">
          One script per wallet per match. Builder stays hidden so you do not lock twice by mistake.
        </p>
      </div>
    </div>
  );
}
