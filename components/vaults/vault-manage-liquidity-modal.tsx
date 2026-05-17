"use client";

import { type MouseEvent, useCallback, useEffect, useId } from "react";

type Mode = "add" | "remove";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  depositStr: string;
  onDepositStrChange: (v: string) => void;
  withdrawStr: string;
  onWithdrawStrChange: (v: string) => void;
  walletPlayFormatted: string;
  freeFloatFormatted: string;
  onApprove: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onFillMaxDeposit: () => void;
  onFillMaxWithdraw: () => void;
  busy: boolean;
  connected: boolean;
  wrongChain: boolean;
  userSharesZero: boolean;
  err: string | null;
  ok: string | null;
};

export function VaultManageLiquidityModal({
  open,
  onClose,
  mode,
  onModeChange,
  depositStr,
  onDepositStrChange,
  withdrawStr,
  onWithdrawStrChange,
  walletPlayFormatted,
  freeFloatFormatted,
  onApprove,
  onDeposit,
  onWithdraw,
  onFillMaxDeposit,
  onFillMaxWithdraw,
  busy,
  connected,
  wrongChain,
  userSharesZero,
  err,
  ok,
}: Props) {
  const titleId = useId();

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
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-xl"
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold text-[var(--foreground)]">
            Manage liquidity
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border)] text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            ×
          </button>
        </div>

        <div className="mb-4 flex rounded-lg border border-[var(--border)] p-0.5">
          <button
            type="button"
            onClick={() => onModeChange("add")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
              mode === "add"
                ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => onModeChange("remove")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
              mode === "remove"
                ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            Remove
          </button>
        </div>

        {!connected && <p className="text-sm text-[var(--muted)]">Connect a wallet on Somnia testnet.</p>}
        {wrongChain && <p className="text-sm text-amber-200/90">Switch network to Somnia testnet.</p>}

        {connected && !wrongChain && mode === "add" && (
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              Deposits pull PLAY from your wallet and mint LP shares. You can add at most your wallet PLAY balance (
              <span className="font-mono text-[var(--foreground)]">{walletPlayFormatted}</span>).
            </p>
            <div>
              <label className="block text-xs font-medium text-[var(--muted)]" htmlFor="modal-dep">
                Amount (PLAY)
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="modal-dep"
                  value={depositStr}
                  onChange={(e) => onDepositStrChange(e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm text-[var(--foreground)]"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={onFillMaxDeposit}
                  className="shrink-0 rounded-md border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-highlight-hover)] disabled:opacity-50"
                >
                  Max
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onApprove}
                className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-highlight-hover)] disabled:opacity-50"
              >
                Approve PLAY
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onDeposit}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Deposit
              </button>
            </div>
          </div>
        )}

        {connected && !wrongChain && mode === "remove" && (
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              Withdraw burns LP shares. The vault pays the smaller of your pro-rata PLAY and{" "}
              <span className="font-mono text-[11px] text-[var(--foreground)]">freeFloat()</span>. Current free float:{" "}
              <span className="font-mono text-[var(--foreground)]">{freeFloatFormatted}</span> PLAY.
            </p>
            <div>
              <label className="block text-xs font-medium text-[var(--muted)]" htmlFor="modal-wd">
                Shares to burn
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="modal-wd"
                  value={withdrawStr}
                  onChange={(e) => onWithdrawStrChange(e.target.value)}
                  placeholder="0"
                  className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm text-[var(--foreground)]"
                />
                <button
                  type="button"
                  disabled={busy || userSharesZero}
                  onClick={onFillMaxWithdraw}
                  className="shrink-0 rounded-md border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-highlight-hover)] disabled:opacity-50"
                >
                  Max
                </button>
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onWithdraw}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-highlight-hover)] disabled:opacity-50"
            >
              Withdraw
            </button>
          </div>
        )}

        {err ? <p className="mt-4 text-sm text-rose-300">{err}</p> : null}
        {ok ? <p className="mt-4 text-sm text-emerald-300/90">{ok}</p> : null}
      </div>
    </div>
  );
}
