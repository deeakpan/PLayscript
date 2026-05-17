"use client";

import { type MouseEvent, useCallback, useEffect, useId } from "react";
import { formatUnits } from "viem";

import type { V2LockQuote } from "@/lib/playscript-v2-lock-quote";
import { payoutMultiplierLabel } from "@/lib/playscript-v2-lock-quote";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
  decimals: number;
  matchId: string;
  stakeInput: string;
  onStakeInputChange: (value: string) => void;
  quote: V2LockQuote | null;
  matchLiabilityWei: bigint | null;
  matchLiabilityCapWei: bigint | null;
  difficultyScore: bigint | null;
};

function fmtPlay(wei: bigint, decimals: number): string {
  const s = formatUnits(wei, decimals);
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function DetailRow({
  label,
  value,
  valueClassName,
  sub,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-row items-start justify-between gap-3 border-b border-[var(--border)]/50 py-2.5 last:border-b-0 last:pb-0">
      <p className="min-w-0 shrink pt-0.5 text-[11px] font-medium leading-snug text-[var(--muted)]">{label}</p>
      <div className="shrink-0 text-right">
        <p className="font-mono text-xs font-semibold tabular-nums tracking-tight">
          <span className={valueClassName ?? "text-[var(--foreground)]"}>{value}</span>
          <span className="ml-1 text-[10px] font-medium text-[var(--muted)]">PLAY</span>
        </p>
        {sub ? (
          <p className="mt-0.5 text-right text-[10px] font-normal leading-snug text-[var(--muted)]">{sub}</p>
        ) : null}
      </div>
    </div>
  );
}

export function FixtureLockScriptModal({
  open,
  onClose,
  onConfirm,
  busy,
  decimals,
  matchId,
  stakeInput,
  onStakeInputChange,
  quote,
  matchLiabilityWei,
  matchLiabilityCapWei,
  difficultyScore,
}: Props) {
  const titleId = useId();

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-4"
      role="presentation"
      onMouseDown={onBackdrop}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[0_16px_48px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--border)]/80 bg-[var(--surface)]/50 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p
              id={titleId}
              className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]"
            >
              Lock script
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)]/80 bg-[var(--surface)]/80 text-xs text-[var(--muted)] transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-4 pb-4 pt-2">
          <p className="mb-2 text-[11px] text-[var(--muted)]">
            Match <span className="font-mono text-[var(--accent)]">#{matchId}</span>
            {difficultyScore !== null ? (
              <>
                {" "}
                · difficulty{" "}
                <span className="font-mono text-[var(--foreground)]">{difficultyScore.toString()}</span>
              </>
            ) : null}
          </p>

          <label className="mb-3 flex flex-col gap-1 text-xs text-[var(--muted)]">
            <span>Stake (PLAY)</span>
            <input
              type="text"
              inputMode="decimal"
              value={stakeInput}
              onChange={(e) => onStakeInputChange(e.target.value)}
              disabled={busy}
              className="rounded-lg border border-[var(--border)]/80 bg-[var(--background)]/80 px-3 py-2 font-mono text-sm text-[var(--foreground)] outline-none ring-[var(--accent)]/30 focus-visible:ring-2 disabled:opacity-50"
            />
          </label>

          {matchLiabilityCapWei !== null && matchLiabilityWei !== null ? (
            <p className="mb-2 text-[10px] leading-relaxed text-[var(--muted)]">
              Match liability{" "}
              <span className="font-mono text-[var(--foreground)]">{fmtPlay(matchLiabilityWei, decimals)}</span>
              {" / "}
              <span className="font-mono text-[var(--foreground)]">{fmtPlay(matchLiabilityCapWei, decimals)}</span>
              {quote ? (
                <>
                  {" "}
                  · room for this lock{" "}
                  <span className="font-mono text-[var(--accent)]">{fmtPlay(quote.liabilityRoomWei, decimals)}</span>
                </>
              ) : null}
            </p>
          ) : null}

          {quote?.partialFill ? (
            <p className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-100/90">
              Partial fill: only{" "}
              <span className="font-mono font-medium">{fmtPlay(quote.actualStakeWei, decimals)}</span> PLAY will be
              locked;{" "}
              <span className="font-mono font-medium">{fmtPlay(quote.refundWei, decimals)}</span> stays in your wallet.
            </p>
          ) : null}

          {quote?.noRoom ? (
            <p className="mb-2 rounded-md border border-rose-500/35 bg-rose-500/10 px-2.5 py-2 text-[11px] text-rose-200/95">
              No liability room left on this match. Try a lower stake or wait for other locks to settle.
            </p>
          ) : null}

          {quote && !quote.noRoom ? (
            <div className="rounded-lg border border-[var(--border)]/60 bg-[var(--surface)]/35 px-3 py-0.5">
              <DetailRow label="You send" value={fmtPlay(quote.playAmountWei, decimals)} />
              <DetailRow
                label="Locked stake (gross)"
                value={fmtPlay(quote.actualStakeWei, decimals)}
                sub={quote.partialFill ? "Capped by match / vault room" : undefined}
              />
              <DetailRow label="Lock fee (0.5%)" value={fmtPlay(quote.lockFeeWei, decimals)} />
              <DetailRow label="Net stake (ticket)" value={fmtPlay(quote.netStakeWei, decimals)} />
              <DetailRow
                label="Payout if 5/5 win"
                value={fmtPlay(quote.payoutIfWinWei, decimals)}
                valueClassName="text-emerald-300/95"
                sub={`${mult} on net stake · claim after settlement`}
              />
              {quote.refundWei > BigInt(0) ? (
                <DetailRow label="Refunded to wallet" value={fmtPlay(quote.refundWei, decimals)} />
              ) : null}
              <DetailRow
                label="Profit if win"
                value={fmtPlay(
                  quote.payoutIfWinWei > quote.netStakeWei
                    ? quote.payoutIfWinWei - quote.netStakeWei
                    : BigInt(0),
                  decimals,
                )}
                valueClassName="text-[var(--accent)]"
              />
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border)]/70 pt-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-lg border border-[var(--border)]/80 bg-[var(--surface)]/40 px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={confirmDisabled}
              onClick={onConfirm}
              className="rounded-lg border border-[var(--accent)]/40 bg-[var(--surface-active)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-[var(--accent)]/55 hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {busy ? "Confirm in wallet…" : "Approve (if needed) & lock"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
