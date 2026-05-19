"use client";

import { formatDistanceStrict } from "date-fns";
import { type MouseEvent, useCallback, useEffect, useId, useMemo } from "react";

import type { V2LockQuote } from "@/lib/playscript-v2-lock-quote";
import { payoutMultiplierLabel } from "@/lib/playscript-v2-lock-quote";
import { formatPlayAmount } from "@/lib/format-play-display";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
  success: boolean;
  decimals: number;
  quote: V2LockQuote | null;
  selections: readonly string[];
  kickoffUtc: string;
};

function kickoffLabel(kickoffUtc: string, nowMs: number): string {
  const kick = new Date(kickoffUtc).getTime();
  if (!Number.isFinite(kick)) return "—";
  if (kick <= nowMs) return "Started";
  return formatDistanceStrict(new Date(kick), new Date(nowMs), { addSuffix: false });
}

function SummaryLine({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <span
        className={`text-right text-sm font-semibold tabular-nums ${accent ? "text-emerald-300/95" : "text-[var(--foreground)]"}`}
      >
        {value}
        <span className="ml-1 text-[10px] font-medium text-[var(--muted)]">PLAY</span>
      </span>
    </div>
  );
}

export function FixtureLockScriptModal({
  open,
  onClose,
  onConfirm,
  busy,
  success,
  decimals,
  quote,
  selections,
  kickoffUtc,
}: Props) {
  const titleId = useId();
  const nowMs = useMemo(() => Date.now(), [open]);

  const onBackdrop = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && !busy) onClose();
    },
    [busy, onClose],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const mult = quote ? payoutMultiplierLabel(quote.payoutRate) : "—";
  const confirmDisabled = busy || !quote || quote.noRoom || quote.netStakeWei === BigInt(0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={onBackdrop}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[0_16px_48px_-8px_rgba(0,0,0,0.55)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)]/80 px-4 py-3">
          <p id={titleId} className="text-sm font-semibold text-[var(--foreground)]">
            {success ? "Script locked" : "Review script"}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-4">
          {success ? (
            <div className="flex flex-col items-center py-2 text-center">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-400/40"
                aria-hidden
              >
                <span className="text-3xl font-bold text-emerald-400">✓</span>
              </div>
              <p className="mt-4 text-base font-semibold text-[var(--foreground)]">Successfully locked</p>
              <p className="mt-1 text-sm text-emerald-300/95">Good luck!</p>
              <p className="mt-3 max-w-[16rem] text-xs leading-relaxed text-[var(--muted)]">
                Your script is live. You can withdraw stake before kickoff from the match page.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 w-full rounded-lg border border-emerald-500/35 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-200/95 hover:bg-emerald-500/15"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {quote?.noRoom ? (
                <p className="text-xs text-rose-300/95">No room left on this match. Try a lower stake later.</p>
              ) : quote ? (
                <>
                  <SummaryLine label="Stake" value={formatPlayAmount(quote.actualStakeWei, decimals)} />
                  <SummaryLine label="Net (after fees)" value={formatPlayAmount(quote.netStakeWei, decimals)} />
                  <SummaryLine
                    label="Potential payout (5/5)"
                    value={formatPlayAmount(quote.payoutIfWinWei, decimals)}
                    accent
                  />
                  <SummaryLine label="Multiplier" value={mult} />

                  <div className="my-3 border-t border-[var(--border)]/70" />

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Selections
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {selections.map((line) => (
                      <li key={line} className="text-xs leading-snug text-[var(--foreground)]">
                        {line}
                      </li>
                    ))}
                  </ul>

                  <p className="mt-3 text-xs text-[var(--muted)]">
                    Kickoff in{" "}
                    <span className="font-medium tabular-nums text-[var(--foreground)]">
                      {kickoffLabel(kickoffUtc, nowMs)}
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-xs text-[var(--muted)]">Enter a stake to continue.</p>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-[var(--border)]/80 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={confirmDisabled}
                  onClick={onConfirm}
                  className="flex-1 rounded-lg border border-[var(--accent)]/40 bg-[var(--surface-active)] py-2 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)]/55 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {busy ? "Confirm in wallet…" : "Lock script"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
