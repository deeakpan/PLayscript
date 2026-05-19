"use client";

import { type MouseEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { invalidatePlayBalance, usePlayBalance } from "@/hooks/use-play-balance";
import {
  faucetStatusQueryKey,
  useFaucetStatus,
  type FaucetStatusData,
} from "@/hooks/use-faucet-status";
import { formatPlayAmount } from "@/lib/format-play-display";
import { formatTryAgainIn } from "@/lib/faucet/format-retry";
import {
  patchFaucetStatusAfterClaim,
  postFaucetClaim,
  SOMNIA_EXPLORER_TX,
} from "@/lib/faucet/client";

type Props = {
  open: boolean;
  onClose: () => void;
  address: `0x${string}`;
};

type ClaimSuccess = {
  txHash: string;
  amountPlay: string;
};

export function PlayFaucetModal({ open, onClose, address }: Props) {
  const titleId = useId();
  const queryClient = useQueryClient();
  const statusQ = useFaucetStatus(open);
  const balanceQ = usePlayBalance();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<ClaimSuccess | null>(null);
  const openedOnce = useRef(false);

  const balanceWei = useMemo(() => {
    if (balanceQ.data) return balanceQ.data.raw;
    if (statusQ.data?.balance) return BigInt(statusQ.data.balance);
    return null;
  }, [balanceQ.data, statusQ.data]);

  const decimals = balanceQ.data?.decimals ?? statusQ.data?.decimals ?? 18;

  const canClaim = statusQ.isPending ? false : (statusQ.data?.canClaim ?? false);
  const nextClaimAt = statusQ.data?.nextClaimAt ?? null;
  const tryAgainIn = formatTryAgainIn(nextClaimAt);

  const onBackdrop = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && !busy) onClose();
    },
    [busy, onClose],
  );

  useEffect(() => {
    if (!open) {
      openedOnce.current = false;
      return;
    }
    if (!openedOnce.current) {
      openedOnce.current = true;
      setErr(null);
      setSuccess(null);
      void statusQ.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when modal opens
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  const onClaim = async () => {
    setErr(null);
    setSuccess(null);
    setBusy(true);
    try {
      const result = await postFaucetClaim(address);

      if (!result.ok) {
        if (result.status === 429 || result.code === "already_claimed") {
          queryClient.setQueryData<FaucetStatusData>(faucetStatusQueryKey(address), (prev) => {
            const base: FaucetStatusData = prev ?? {
              dailyAmountPlay: "100",
              canClaim: true,
              lastClaimDay: null,
              nextClaimAt: null,
              balance: "0",
              decimals: 18,
            };
            return {
              ...base,
              canClaim: false,
              nextClaimAt: result.nextClaimAt ?? base.nextClaimAt,
            };
          });
          await statusQ.refetch();
          return;
        }
        setErr(result.error);
        return;
      }

      setSuccess({ txHash: result.txHash, amountPlay: result.amountPlay });
      queryClient.setQueryData<FaucetStatusData>(
        faucetStatusQueryKey(address),
        (prev) => patchFaucetStatusAfterClaim(prev, result.balance, result.decimals),
      );
      await Promise.all([statusQ.refetch(), balanceQ.refetch(), invalidatePlayBalance(queryClient)]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const daily = statusQ.data?.dailyAmountPlay ?? "100";
  const claimDisabled = busy || statusQ.isPending || !canClaim || !!success;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={onBackdrop}
    >
      <FaucetDialogShell titleId={titleId} onClose={onClose} busy={busy}>
        <div className="px-4 py-3">
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            Testnet faucet — claim <span className="font-semibold text-[var(--foreground)]">{daily} PLAY</span>{" "}
            once per UTC day per wallet.
          </p>

          <div className="mt-4 rounded-lg border border-[var(--border)]/80 bg-[var(--surface)]/60 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Your balance</p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--foreground)]">
              {balanceQ.isPending && balanceWei === null
                ? "…"
                : balanceWei !== null
                  ? formatPlayAmount(balanceWei, decimals)
                  : "—"}{" "}
              <span className="text-base text-[var(--accent)]">PLAY</span>
            </p>
          </div>

          {success ? (
            <div className="mt-3" role="status">
              <p className="text-sm text-[var(--foreground)]">
                Sent {success.amountPlay} PLAY successfully.
              </p>
              {success.txHash ? (
                <a
                  href={`${SOMNIA_EXPLORER_TX}${success.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block max-w-full truncate font-mono text-xs text-emerald-400 underline-offset-2 hover:text-emerald-300 hover:underline"
                >
                  {success.txHash}
                </a>
              ) : null}
            </div>
          ) : null}

          {!canClaim && !success && !statusQ.isPending ? (
            <div
              className="mt-3 rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2.5"
              role="alert"
            >
              <p className="text-sm font-semibold text-amber-100/95">Already claimed!</p>
              <p className="mt-1 text-xs text-amber-100/80">
                {tryAgainIn ? `Try again in ${tryAgainIn}.` : "Try again after UTC midnight."}
              </p>
            </div>
          ) : null}

          {statusQ.isError ? (
            <p className="mt-2 text-xs text-rose-300/95">
              {statusQ.error?.message ?? "Could not load faucet status."}
            </p>
          ) : null}

          {err ? (
            <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-950/25 px-3 py-2.5" role="alert">
              <p className="text-sm font-semibold text-rose-100/95">{err}</p>
            </div>
          ) : null}

          <div className="mt-4 flex gap-2 pb-1">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="flex-1 rounded-lg border border-[var(--border)]/80 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              disabled={claimDisabled}
              onClick={onClaim}
              className="flex-1 rounded-lg border border-[var(--accent)]/40 bg-[var(--surface-active)] py-2.5 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)]/55 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {busy ? "Claiming…" : success ? "Claimed" : canClaim ? "Claim" : "Claimed today"}
            </button>
          </div>
        </div>
      </FaucetDialogShell>
    </div>
  );
}

function FaucetDialogShell({
  children,
  titleId,
  onClose,
  busy,
}: {
  children: React.ReactNode;
  titleId: string;
  onClose: () => void;
  busy: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="w-full max-w-sm overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[0_16px_48px_-8px_rgba(0,0,0,0.55)]"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-[var(--border)]/80 px-4 py-3">
        <p id={titleId} className="text-sm font-semibold text-[var(--foreground)]">
          PLAY faucet
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
      {children}
    </div>
  );
}
