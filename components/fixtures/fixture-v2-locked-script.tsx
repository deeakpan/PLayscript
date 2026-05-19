"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { encodeFunctionData } from "viem";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";

import { invalidatePlayBalance } from "@/hooks/use-play-balance";
import type { PlayscriptV2FixtureScript } from "@/hooks/use-playscript-v2-fixture-script";
import { somniaTestnet } from "@/lib/chains/somnia";
import { sendWalletTx } from "@/lib/send-wallet-tx";
import { difficultyLabel } from "@/lib/playscript-v2-legs";
import { getPlayscriptV2PositionsEnv } from "@/lib/playscript-public-env";
import { playscriptV2PositionsWriteAbi } from "@/lib/playscript-v2-positions-abi";

type LockedScript = Extract<PlayscriptV2FixtureScript, { hasScript: true }>;

type Props = {
  script: LockedScript;
  matchId: bigint;
  displayStatus: "open" | "live" | "finished" | "closing_soon";
};

function scoreDisplayClass(correct: number, total: number): string {
  if (correct >= total) return "text-emerald-400";
  if (correct >= total - 1) return "text-emerald-400/90";
  return "text-zinc-400";
}

export function FixtureV2LockedScript({ script, matchId, displayStatus }: Props) {
  const queryClient = useQueryClient();
  const { address, status, chainId } = useConnection();
  const connected = status === "connected";
  const wrongChain = connected && chainId !== somniaTestnet.id;
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: somniaTestnet.id });
  const positionsEnv = getPlayscriptV2PositionsEnv();

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const liveTicksKnown = script.picks.some((p) => p.correct !== null);
  const showTicks = script.settled || liveTicksKnown;
  const liveCorrectCount = script.picks.filter((p) => p.correct === true).length;
  const scoreCount = script.settled ? script.correctCount : liveCorrectCount;

  const statusLine = script.settled
    ? script.isWinner
      ? "Winner — all picks hit"
      : `${script.correctCount}/${script.totalPicks} correct`
    : script.settleInProgress
      ? "Settling onchain…"
      : displayStatus === "live"
        ? liveTicksKnown
          ? `${liveCorrectCount}/${script.totalPicks} correct so far`
          : "Match in progress"
        : displayStatus === "finished"
          ? liveTicksKnown
            ? `${liveCorrectCount}/${script.totalPicks} from scoreline (awaiting onchain)`
            : "Awaiting settlement"
          : "Locked — good luck";

  const onClaim = useCallback(async () => {
    setErr(null);
    setOkMsg(null);
    if (!address || !walletClient || !publicClient || !positionsEnv.ok) return;
    setBusy(true);
    try {
      const hash = await sendWalletTx({
        walletClient,
        publicClient,
        account: address,
        chain: somniaTestnet,
        to: positionsEnv.positions,
        data: encodeFunctionData({
          abi: playscriptV2PositionsWriteAbi,
          functionName: "claim",
          args: [matchId, script.legMask12, script.balance],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await queryClient.invalidateQueries({ queryKey: ["v2-fixture-script"] });
      await invalidatePlayBalance(queryClient);
      setOkMsg("Payout claimed.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [
    address,
    matchId,
    positionsEnv,
    publicClient,
    queryClient,
    script.balance,
    script.legMask12,
    walletClient,
  ]);

  const onUnwind = useCallback(async () => {
    setErr(null);
    setOkMsg(null);
    if (!address || !walletClient || !publicClient || !positionsEnv.ok) return;
    if (!script.matchOpen) {
      setErr("Withdraw is only available while the match is still open.");
      return;
    }
    setBusy(true);
    try {
      const hash = await sendWalletTx({
        walletClient,
        publicClient,
        account: address,
        chain: somniaTestnet,
        to: positionsEnv.positions,
        data: encodeFunctionData({
          abi: playscriptV2PositionsWriteAbi,
          functionName: "unwind",
          args: [matchId, script.legMask12, script.balance],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await queryClient.invalidateQueries({ queryKey: ["v2-fixture-script"] });
      await queryClient.invalidateQueries({ queryKey: ["playscript-v2-user-scripts"] });
      await invalidatePlayBalance(queryClient);
      setOkMsg("Position withdrawn.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [
    address,
    matchId,
    positionsEnv,
    publicClient,
    queryClient,
    script.balance,
    script.legMask12,
    script.matchOpen,
    walletClient,
  ]);

  const canClaim =
    script.settled && script.isWinner === true && !script.claimed && script.balance > BigInt(0);
  const canUnwind = script.matchOpen && script.balance > BigInt(0);

  return (
    <section aria-label="Your script" className="max-w-xl">
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)]/80 bg-[var(--surface)]/40 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Your script
            </p>
            <p className="mt-1 text-sm text-[var(--foreground)]">{statusLine}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Stake{" "}
              <span className="font-semibold tabular-nums text-[var(--accent)]">
                {script.stakeFormatted} PLAY
              </span>
              {script.payoutFormatted && script.isWinner ? (
                <>
                  {" "}
                  · Payout{" "}
                  <span className="font-semibold tabular-nums text-emerald-300/95">
                    {script.payoutFormatted} PLAY
                  </span>
                </>
              ) : null}
            </p>
            {script.settled && script.finalScoreLabel ? (
              <p className="mt-1 text-[11px] tabular-nums text-[var(--muted)]">
                Settled onchain {script.finalScoreLabel}
                {script.htScoreLabel ? ` · ${script.htScoreLabel}` : null}
              </p>
            ) : null}
            {script.usesLegacyLegBoard ? (
              <p className="mt-1 text-[11px] leading-snug text-amber-200/85">
                This match uses the leg board from when it was registered (labels may differ from
                today&apos;s market).
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p
              className={`font-[family-name:var(--font-syne),ui-sans-serif,sans-serif] text-5xl font-extrabold leading-none tracking-tight tabular-nums sm:text-6xl ${scoreDisplayClass(scoreCount, script.totalPicks)}`}
            >
              {showTicks ? scoreCount : "—"}
              <span className="text-3xl font-bold text-zinc-500 sm:text-4xl">
                /{script.totalPicks}
              </span>
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {script.settled ? "correct" : showTicks ? "so far" : "pending"}
            </p>
          </div>
        </div>

        <ul className="divide-y divide-[var(--border)]/70">
          {script.picks.map((row) => (
            <li
              key={row.legId}
              className="flex items-start gap-3 px-4 py-3 text-sm leading-snug"
            >
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-base font-bold"
                aria-hidden
              >
                {row.correct === null ? (
                  <span className="text-[var(--muted)]">·</span>
                ) : row.correct ? (
                  <span className="text-emerald-400">✓</span>
                ) : (
                  <span className="text-zinc-600">✗</span>
                )}
              </span>
              <span className="min-w-0 flex-1 text-[var(--foreground)]">{row.description}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                {difficultyLabel(row.difficulty)}
              </span>
            </li>
          ))}
        </ul>

        {(canClaim || canUnwind) && connected ? (
          <div className="flex flex-wrap gap-2 border-t border-[var(--border)]/80 px-4 py-3">
            {canUnwind ? (
              <button
                type="button"
                disabled={busy || wrongChain || !walletClient}
                onClick={() => void onUnwind()}
                className="rounded-lg border border-[var(--border)]/80 px-3 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
              >
                Withdraw stake
              </button>
            ) : null}
            {canClaim ? (
              <button
                type="button"
                disabled={busy || wrongChain || !walletClient}
                onClick={() => void onClaim()}
                className="rounded-lg border border-[var(--accent)]/40 bg-[var(--surface-active)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] hover:border-[var(--accent)]/55 disabled:opacity-50"
              >
                {busy ? "Confirm…" : "Claim payout"}
              </button>
            ) : null}
            {script.claimed ? (
              <span className="self-center text-xs text-[var(--muted)]">Claimed</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {wrongChain ? (
        <p className="mt-2 text-xs text-rose-300/90">Switch to Somnia Testnet.</p>
      ) : null}
      {err ? <p className="mt-2 text-xs text-rose-300/90">{err}</p> : null}
      {okMsg ? (
        <p className="mt-2 text-xs font-medium text-emerald-400/95" role="status">
          {okMsg}
        </p>
      ) : null}
    </section>
  );
}
