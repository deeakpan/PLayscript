"use client";

import { type MouseEvent, useCallback, useEffect, useId } from "react";
import { formatUnits } from "viem";

import type { ClaimInfo } from "@/hooks/use-playscript-user-script";

import { PlayscriptClaimPayoutButton } from "@/components/playscript-claim-payout-button";

type Props = {
  open: boolean;
  onClose: () => void;
  scriptId: string;
  stakeFormatted: string;
  stakeWei: string;
  decimals: number;
  claimed: boolean;
  claim: ClaimInfo;
};

function claimNetParts(stakeWei: bigint, mintUserWei: bigint, decimals: number) {
  const netWei = mintUserWei - stakeWei;
  const zero = BigInt(0);
  const abs = netWei < zero ? stakeWei - mintUserWei : netWei;
  const sign = netWei > zero ? "+" : netWei < zero ? "−" : "";
  return { sign, amount: formatUnits(abs, decimals) };
}

function Row({
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
      <p className="min-w-0 shrink pt-0.5 text-[11px] font-medium leading-snug text-[var(--muted)]">
        {label}
      </p>
      <div className="shrink-0 text-right">
        <p className="font-mono text-xs font-semibold tabular-nums tracking-tight">
          <span className={valueClassName ?? "text-[var(--foreground)]"}>{value}</span>
          <span className="ml-1 text-[10px] font-medium text-[var(--muted)]">PLAY</span>
        </p>
        {sub ? (
          <p className="mt-0.5 text-right text-[10px] font-normal leading-snug text-[var(--muted)]">
            {sub}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function FixtureClaimPayoutModal({
  open,
  onClose,
  scriptId,
  stakeFormatted,
  stakeWei,
  decimals,
  claimed,
  claim,
}: Props) {
  const titleId = useId();

  const stakeB = BigInt(stakeWei);
  const mintB = BigInt(claim.mintUserWei);
  const net = claimNetParts(stakeB, mintB, decimals);

  const onBackdrop = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

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
        className="w-full max-w-sm overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[0_16px_48px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--border)]/80 bg-[var(--surface)]/50 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p
              id={titleId}
              className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]"
            >
              Claim payout
            </p>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)]/80 bg-[var(--surface)]/80 text-xs text-[var(--muted)] transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)]"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-4 pb-4 pt-2">
          <div className="rounded-lg border border-[var(--border)]/60 bg-[var(--surface)]/35 px-3 py-0.5">
            <Row label="Stake" value={stakeFormatted} />
            <Row label="Fee (treasury)" value={claim.mintFeeFormatted} />
            <Row
              label="You'll receive"
              value={claim.mintUserFormatted}
              valueClassName={claim.winner ? "text-emerald-300/95" : "text-[var(--foreground)]"}
              sub={
                !claim.winner
                  ? "No PLAY minted below 3/5 slots correct — net is stake vs zero mint."
                  : undefined
              }
            />
            <Row
              label="Net"
              value={`${net.sign}${net.amount}`}
              valueClassName="text-[var(--accent)]"
            />
          </div>

          <div className="mt-4 border-t border-[var(--border)]/70 pt-3">
            {claim.showClaimButton ? (
              <PlayscriptClaimPayoutButton scriptId={scriptId} compact onSuccess={onClose} />
            ) : claimed ? (
              <p className="rounded-md border border-[var(--border)]/50 bg-[var(--surface)]/40 py-2 text-center text-xs text-[var(--muted)]">
                Already claimed for this script.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
