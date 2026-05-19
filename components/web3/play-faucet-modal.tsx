"use client";

import { formatDistanceToNow } from "date-fns";
import { type MouseEvent, useCallback, useEffect, useId, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { invalidatePlayBalance, usePlayBalance } from "@/hooks/use-play-balance";
import { useFaucetStatus } from "@/hooks/use-faucet-status";
import { formatPlayAmount } from "@/lib/format-play-display";

type Props = {
  open: boolean;
  onClose: () => void;
  address: `0x${string}`;
};

export function PlayFaucetModal({ open, onClose, address }: Props) {
  const titleId = useId();
  const queryClient = useQueryClient();
  const statusQ = useFaucetStatus();
  const balanceQ = usePlayBalance();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const balanceWei = useMemo(() => {
    if (balanceQ.data) return balanceQ.data.raw;
    if (statusQ.data?.balance) return BigInt(statusQ.data.balance);
    return null;
  }, [balanceQ.data, statusQ.data]);

  const decimals = balanceQ.data?.decimals ?? statusQ.data?.decimals ?? 18;

  const nextClaimLabel = useMemo(() => {
    const at = statusQ.data?.nextClaimAt;
    if (!at) return null;
    const t = new Date(at).getTime();
    if (!Number.isFinite(t) || t <= Date.now()) return null;
    return formatDistanceToNow(new Date(at), { addSuffix: true });
  }, [statusQ.data?.nextClaimAt]);

  const onBackdrop = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && !busy) onClose();
    },
    [busy, onClose],
  );

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setOkMsg(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  const onClaim = async () => {
    setErr(null);
    setOkMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/faucet/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        amountPlay?: string;
      };
      if (!res.ok || !j.ok) {
        throw new Error(j.error ?? `Claim failed (${res.status})`);
      }
      setOkMsg(`Sent ${j.amountPlay ?? "100"} PLAY to your wallet.`);
      await Promise.all([
        statusQ.refetch(),
        balanceQ.refetch(),
        invalidatePlayBalance(queryClient),
      ]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const canClaim = statusQ.data?.canClaim ?? false;
  const daily = statusQ.data?.dailyAmountPlay ?? "100";
  const claimDisabled = busy || statusQ.isPending || !canClaim;

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

          {statusQ.isError ? (
            <p className="mt-2 text-xs text-rose-300/95">
              {statusQ.error?.message ?? "Could not load faucet status."}
            </p>
          ) : null}

          {!canClaim && !statusQ.isPending ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Already claimed today.
              {nextClaimLabel ? (
                <>
                  {" "}
                  Next claim <span className="font-medium text-[var(--foreground)]">{nextClaimLabel}</span>.
                </>
              ) : null}
            </p>
          ) : null}

          {err ? <p className="mt-2 text-xs text-rose-300/95">{err}</p> : null}
          {okMsg ? <p className="mt-2 text-xs text-emerald-300/95">{okMsg}</p> : null}

          <p className="mt-3 truncate font-mono text-[10px] text-[var(--muted)]" title={address}>
            {address}
          </p>

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
              {busy ? "Claiming…" : canClaim ? "Claim" : "Claimed today"}
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
