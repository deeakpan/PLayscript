"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { encodeFunctionData, formatUnits, maxUint256, parseUnits } from "viem";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";

import { FixtureLockScriptModal } from "@/components/fixtures/fixture-lock-script-modal";
import { invalidatePlayBalance } from "@/hooks/use-play-balance";
import { FixturePlayscriptInlineSpinner } from "@/components/fixtures/fixture-playscript-inline-spinner";
import { somniaTestnet } from "@/lib/chains/somnia";
import type { ScriptSportKey } from "@/lib/fixtures-shared";
import {
  getPlayscriptV2KernelEnv,
  getPlayscriptV2PositionsEnv,
} from "@/lib/playscript-public-env";
import { playTokenReadAbi, playTokenWriteAbi } from "@/lib/playscript-onchain-abi";
import { readKernelMatch } from "@/lib/playscript-v2-kernel-read";
import { playscriptKernelReadAbi, playscriptKernelWriteAbi } from "@/lib/playscript-v2-kernel-abi";
import {
  maxPlayAmountForLiabilityRoom,
  payoutMultiplierLabel,
  quoteV2LockScript,
} from "@/lib/playscript-v2-lock-quote";
import {
  playscriptV2PositionsReadAbi,
  playscriptV2PositionsWriteAbi,
} from "@/lib/playscript-v2-positions-abi";
import {
  buildV2EspnRegisterUrls,
  defaultV2FinalizeDelaySec,
  formatV2FinalizeDelayLabel,
  kickoffUnixFromIsoUtc,
  v2DefaultLegKinds,
  v2DefaultLegWeights,
  v2KernelSportEnum,
  v2MarketLegsForFixture,
} from "@/lib/playscript-v2-register-args";
import {
  ESPN_SCOREBOARD_SELECTORS,
  ESPN_SOCCER_SUMMARY_SELECTORS,
} from "@/lib/espn-v2-selectors";
import { bitmaskPopcount, V2_MASK_MAX, V2_PICK_COUNT } from "@/lib/playscript-v2-legs";
import { usePlayscriptV2MatchByUrl } from "@/hooks/use-playscript-v2-match-by-url";

type Props = {
  lookupeventUrl: string;
  fixtureId: string;
  leagueSlug: string;
  homeTeam: string;
  awayTeam: string;
  sportKey: ScriptSportKey;
  kickoffUtc: string;
  /** Same window as v1 script builder: pre-kickoff, not live/finished. */
  canRegister: boolean;
  /** Current 12-bit leg mask from `PlayscriptV2LegBuilder` (exactly five bits set when ready). */
  legMask12: number;
};

function parseStakeWei(playStake: string, decimals: number): bigint {
  const t = playStake.trim().replace(/,/g, "").replace(/\.$/, "");
  if (!t) throw new Error("Enter a stake amount.");
  return parseUnits(t, decimals);
}

function registerMatchButtonLabel(sportKey: ScriptSportKey): string {
  switch (sportKey) {
    case "soccer":
      return "Register soccer match";
    case "basketball":
      return "Register basketball match";
    case "american_football":
      return "Register American football match";
    case "baseball":
      return "Register baseball match";
    default:
      return "Register match";
  }
}

export function FixturePlayscriptV2Section({
  lookupeventUrl,
  fixtureId,
  leagueSlug,
  homeTeam,
  awayTeam,
  sportKey,
  kickoffUtc,
  canRegister,
  legMask12,
}: Props) {
  const env = useMemo(() => getPlayscriptV2KernelEnv(), []);
  const positionsEnv = useMemo(() => getPlayscriptV2PositionsEnv(), []);
  const q = usePlayscriptV2MatchByUrl(lookupeventUrl);
  const { address, status, chainId } = useConnection();
  const connected = status === "connected";
  const wrongChain = connected && chainId !== somniaTestnet.id;

  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: somniaTestnet.id });
  const queryClient = useQueryClient();

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [stakePlay, setStakePlay] = useState("10");
  const [lockModalOpen, setLockModalOpen] = useState(false);

  const matchId = q.data?.matchId ?? null;

  const kickoffSec = useMemo(() => kickoffUnixFromIsoUtc(kickoffUtc), [kickoffUtc]);
  const kickoffFuture = kickoffSec > Math.floor(Date.now() / 1000) + 45;

  const legMaskNorm = legMask12 & V2_MASK_MAX;
  const maskReady = bitmaskPopcount(legMaskNorm) === V2_PICK_COUNT;

  const decimalsQ = useQuery({
    queryKey: ["play-token-decimals", positionsEnv.ok ? positionsEnv.playToken : null],
    enabled: positionsEnv.ok && !!publicClient,
    queryFn: async () => {
      if (!positionsEnv.ok || !publicClient) throw new Error("no token");
      return publicClient.readContract({
        address: positionsEnv.playToken,
        abi: playTokenReadAbi,
        functionName: "decimals",
      });
    },
    staleTime: 3600_000,
  });
  const decimals = typeof decimalsQ.data === "number" ? decimalsQ.data : 18;

  const chainMatchQ = useQuery({
    queryKey: ["v2-kernel-match-row", env.ok ? env.kernel : null, matchId?.toString() ?? null],
    enabled: env.ok && matchId !== null && !!publicClient,
    queryFn: async () => {
      if (!env.ok || matchId === null || !publicClient) throw new Error("bad");
      return readKernelMatch(publicClient, env.kernel, matchId);
    },
    refetchInterval: 20_000,
  });

  const positionQ = useQuery({
    queryKey: [
      "v2-erc1155-position",
      positionsEnv.ok ? positionsEnv.positions : null,
      address ?? null,
      matchId?.toString() ?? null,
      legMaskNorm,
    ],
    enabled:
      positionsEnv.ok &&
      env.ok &&
      matchId !== null &&
      !!address &&
      !!publicClient &&
      maskReady,
    queryFn: async () => {
      if (!positionsEnv.ok || !publicClient || matchId === null || !address) {
        throw new Error("missing deps");
      }
      const tokenId = await publicClient.readContract({
        address: positionsEnv.positions,
        abi: playscriptV2PositionsReadAbi,
        functionName: "scriptTokenId",
        args: [matchId, legMaskNorm as number],
      });
      const balance = await publicClient.readContract({
        address: positionsEnv.positions,
        abi: playscriptV2PositionsReadAbi,
        functionName: "balanceOf",
        args: [address, tokenId],
      });
      return { tokenId, balance };
    },
    refetchInterval: 18_000,
  });

  const matchOpen = chainMatchQ.data?.state === 0;
  const matchLiabilityWei = chainMatchQ.data?.matchLiability ?? null;
  const matchLiabilityCapWei = chainMatchQ.data?.matchLiabilityCap ?? null;

  const lockQuoteQ = useQuery({
    queryKey: [
      "v2-lock-quote",
      env.ok ? env.kernel : null,
      matchId?.toString() ?? null,
      legMaskNorm,
    ],
    enabled: env.ok && matchId !== null && !!publicClient && maskReady && matchOpen,
    queryFn: async () => {
      if (!env.ok || matchId === null || !publicClient) throw new Error("missing deps");
      const [room, rate, score] = await Promise.all([
        publicClient.readContract({
          address: env.kernel,
          abi: playscriptKernelReadAbi,
          functionName: "lockRoom",
          args: [matchId],
        }),
        publicClient.readContract({
          address: env.kernel,
          abi: playscriptKernelReadAbi,
          functionName: "payoutRateForMask",
          args: [matchId, legMaskNorm as number],
        }),
        publicClient.readContract({
          address: env.kernel,
          abi: playscriptKernelReadAbi,
          functionName: "difficultyScore",
          args: [matchId, legMaskNorm as number],
        }),
      ]);
      return { room, rate, score };
    },
    refetchInterval: 12_000,
  });

  const stakeWeiParsed = useMemo(() => {
    try {
      const t = stakePlay.trim().replace(/,/g, "").replace(/\.$/, "");
      if (!t) return null;
      return parseUnits(t, decimals);
    } catch {
      return null;
    }
  }, [stakePlay, decimals]);

  const lockQuote = useMemo(() => {
    if (!stakeWeiParsed || stakeWeiParsed === BigInt(0) || !lockQuoteQ.data) return null;
    return quoteV2LockScript(stakeWeiParsed, lockQuoteQ.data.room, lockQuoteQ.data.rate);
  }, [stakeWeiParsed, lockQuoteQ.data]);

  const maxStakeWei = useMemo(() => {
    if (!lockQuoteQ.data) return null;
    return maxPlayAmountForLiabilityRoom(lockQuoteQ.data.room, lockQuoteQ.data.rate);
  }, [lockQuoteQ.data]);

  const registerArgs = useMemo(() => {
    if (!env.ok || !leagueSlug.trim()) return null;
    const legs = v2MarketLegsForFixture(fixtureId, homeTeam, awayTeam, sportKey);
    const urls = buildV2EspnRegisterUrls(leagueSlug, fixtureId, sportKey);
    return {
      kernel: env.kernel,
      sport: v2KernelSportEnum(sportKey),
      kickoff: BigInt(kickoffSec),
      finalizeDelaySec: defaultV2FinalizeDelaySec(sportKey),
      url: urls.url,
      scoreboardUrl: urls.scoreboardUrl,
      summaryUrl: urls.summaryUrl,
      selHomeScore: ESPN_SCOREBOARD_SELECTORS.homeScore,
      selAwayScore: ESPN_SCOREBOARD_SELECTORS.awayScore,
      selHtHome: ESPN_SOCCER_SUMMARY_SELECTORS.htHome,
      selHtAway: ESPN_SOCCER_SUMMARY_SELECTORS.htAway,
      selYellowHome: ESPN_SOCCER_SUMMARY_SELECTORS.yellowHome,
      selYellowAway: ESPN_SOCCER_SUMMARY_SELECTORS.yellowAway,
      selRedHome: ESPN_SOCCER_SUMMARY_SELECTORS.redHome,
      selRedAway: ESPN_SOCCER_SUMMARY_SELECTORS.redAway,
      selHomeQ1: ESPN_SCOREBOARD_SELECTORS.homeQ1,
      selHomeQ2: ESPN_SCOREBOARD_SELECTORS.homeQ2,
      selAwayQ1: ESPN_SCOREBOARD_SELECTORS.awayQ1,
      selAwayQ2: ESPN_SCOREBOARD_SELECTORS.awayQ2,
      legKinds: v2DefaultLegKinds(legs),
      legWeights: v2DefaultLegWeights(legs),
    };
  }, [env, fixtureId, leagueSlug, homeTeam, awayTeam, sportKey, kickoffSec]);

  const onRegister = useCallback(async () => {
    setErr(null);
    setOkMsg(null);
    if (!env.ok || !registerArgs || !address || !walletClient || !publicClient) return;
    if (!kickoffFuture) {
      setErr("Kickoff must be in the future on-chain — this fixture is too close or already started.");
      return;
    }
    setBusy(true);
    try {
      const preflightParams = new URLSearchParams({
        leagueSlug: leagueSlug.trim(),
        eventId: fixtureId.trim(),
        sport: sportKey,
      });
      const preflightRes = await fetch(
        `/api/playscript/espn-preflight?${preflightParams.toString()}`,
        { cache: "no-store" },
      );
      const preflightBody = (await preflightRes.json()) as { ok?: boolean; error?: string };
      if (!preflightRes.ok || !preflightBody.ok) {
        throw new Error(
          preflightBody.error ??
            `ESPN preflight failed (${preflightRes.status}). Check league and event id.`,
        );
      }

      const hash = await walletClient.sendTransaction({
        chain: somniaTestnet,
        account: address,
        to: registerArgs.kernel,
        data: encodeFunctionData({
          abi: playscriptKernelWriteAbi,
          functionName: "registerMatch",
          args: [
            registerArgs.sport,
            registerArgs.kickoff,
            registerArgs.finalizeDelaySec,
            registerArgs.url,
            registerArgs.scoreboardUrl,
            registerArgs.summaryUrl,
            registerArgs.selHomeScore,
            registerArgs.selAwayScore,
            registerArgs.selHtHome,
            registerArgs.selHtAway,
            registerArgs.selYellowHome,
            registerArgs.selYellowAway,
            registerArgs.selRedHome,
            registerArgs.selRedAway,
            registerArgs.selHomeQ1,
            registerArgs.selHomeQ2,
            registerArgs.selAwayQ1,
            registerArgs.selAwayQ2,
            [...registerArgs.legKinds] as [
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
            ],
            [...registerArgs.legWeights] as [
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
              number,
            ],
          ],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await queryClient.invalidateQueries({ queryKey: ["playscript-v2-match-url"] });
      setOkMsg("Match registered on Playscript v2. This page will pick up the new match id shortly.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg.length > 260 ? `${msg.slice(0, 260)}…` : msg);
    } finally {
      setBusy(false);
    }
  }, [
    address,
    env,
    kickoffFuture,
    publicClient,
    queryClient,
    fixtureId,
    leagueSlug,
    registerArgs,
    sportKey,
    walletClient,
  ]);

  const onLockV2 = useCallback(async () => {
    setErr(null);
    setOkMsg(null);
    if (
      !env.ok ||
      !positionsEnv.ok ||
      matchId === null ||
      !address ||
      !walletClient ||
      !publicClient ||
      !maskReady
    ) {
      return;
    }

    let stakeWei: bigint;
    try {
      stakeWei = parseStakeWei(stakePlay, decimals);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Invalid stake");
      return;
    }
    if (stakeWei === BigInt(0)) {
      setErr("Stake must be greater than zero.");
      return;
    }
    if (lockQuote?.noRoom) {
      setErr("No liability room left on this match for this script.");
      return;
    }

    setBusy(true);
    try {
      const allowance = await publicClient.readContract({
        address: positionsEnv.playToken,
        abi: playTokenReadAbi,
        functionName: "allowance",
        args: [address, positionsEnv.positions],
      });

      const approveAmount =
        lockQuote && lockQuote.actualStakeWei > BigInt(0) ? lockQuote.actualStakeWei : stakeWei;

      if (allowance < approveAmount) {
        const hashA = await walletClient.sendTransaction({
          chain: somniaTestnet,
          account: address,
          to: positionsEnv.playToken,
          data: encodeFunctionData({
            abi: playTokenWriteAbi,
            functionName: "approve",
            args: [positionsEnv.positions, maxUint256],
          }),
        });
        await publicClient.waitForTransactionReceipt({ hash: hashA });
      }

      const hashL = await walletClient.sendTransaction({
        chain: somniaTestnet,
        account: address,
        to: positionsEnv.positions,
        data: encodeFunctionData({
          abi: playscriptV2PositionsWriteAbi,
          functionName: "lockScript",
          args: [matchId, legMaskNorm as number, stakeWei],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash: hashL });

      await queryClient.invalidateQueries({ queryKey: ["v2-erc1155-position"] });
      await queryClient.invalidateQueries({ queryKey: ["v2-lock-quote"] });
      await queryClient.invalidateQueries({ queryKey: ["v2-kernel-match-row"] });
      await invalidatePlayBalance(queryClient);
      setLockModalOpen(false);
      setOkMsg("Script locked. If you win after settlement, claim PLAY from this ticket.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg.length > 260 ? `${msg.slice(0, 260)}…` : msg);
    } finally {
      setBusy(false);
    }
  }, [
    address,
    decimals,
    env.ok,
    legMaskNorm,
    maskReady,
    matchId,
    positionsEnv,
    publicClient,
    queryClient,
    lockQuote,
    stakePlay,
    walletClient,
  ]);

  const onUnwindMax = useCallback(async () => {
    setErr(null);
    setOkMsg(null);
    if (
      !env.ok ||
      !positionsEnv.ok ||
      matchId === null ||
      !address ||
      !walletClient ||
      !publicClient ||
      !maskReady
    ) {
      return;
    }
    const bal = positionQ.data?.balance ?? BigInt(0);
    if (bal === BigInt(0)) {
      setErr("No ERC-1155 balance for this mask.");
      return;
    }
    if (!matchOpen) {
      setErr("Unwind is only allowed while the kernel match is still OPEN.");
      return;
    }

    setBusy(true);
    try {
      const hash = await walletClient.sendTransaction({
        chain: somniaTestnet,
        account: address,
        to: positionsEnv.positions,
        data: encodeFunctionData({
          abi: playscriptV2PositionsWriteAbi,
          functionName: "unwind",
          args: [matchId, legMaskNorm as number, bal],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await queryClient.invalidateQueries({ queryKey: ["v2-erc1155-position"] });
      await invalidatePlayBalance(queryClient);
      setOkMsg("Unwound — PLAY returned (match still OPEN).");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg.length > 260 ? `${msg.slice(0, 260)}…` : msg);
    } finally {
      setBusy(false);
    }
  }, [
    address,
    env.ok,
    legMaskNorm,
    maskReady,
    matchId,
    matchOpen,
    positionQ.data?.balance,
    positionsEnv,
    publicClient,
    queryClient,
    walletClient,
  ]);

  if (!env.ok) {
    return null;
  }

  if (q.isPending || q.isFetching) {
    return (
      <section className="border-t border-[var(--border)] pt-8" aria-label="Onchain match">
        <FixturePlayscriptInlineSpinner label="Checking onchain match…" />
      </section>
    );
  }

  if (q.isError) {
    return (
      <section className="border-t border-[var(--border)] pt-8" aria-label="Onchain match">
        <p className="text-sm text-rose-300/90">Could not query kernel ({q.error.message}).</p>
      </section>
    );
  }

  if (matchId !== null) {
    return (
      <section className="border-t border-[var(--border)] pt-8" aria-label="Onchain match">
        <p className="max-w-xl text-sm text-[var(--foreground)]">
          Match <span className="font-mono text-[var(--accent)]">#{matchId.toString()}</span> on the
          kernel.
        </p>

        {positionsEnv.ok ? (
          maskReady ? (
            <div className="mt-4 max-w-xl space-y-3 rounded-xl border border-[var(--border)]/70 bg-[var(--surface)]/20 p-4">
              {chainMatchQ.isPending ? (
                <FixturePlayscriptInlineSpinner label="Loading match state…" />
              ) : chainMatchQ.isError ? (
                <p className="text-xs text-rose-300/90">Could not read kernel match ({chainMatchQ.error.message}).</p>
              ) : (
                <>
                <p className="text-xs leading-relaxed text-[var(--muted)]">
                  Kernel state:{" "}
                  <span className="font-medium text-[var(--foreground)]">
                    {matchOpen ? "OPEN (lock & unwind allowed)" : "Not OPEN — unwind disabled"}
                  </span>
                  {matchLiabilityCapWei !== null && matchLiabilityWei !== null ? (
                    <>
                      {" "}
                      · match liability{" "}
                      <span className="font-mono text-[var(--foreground)]">
                        {formatUnits(matchLiabilityWei, decimals)}
                      </span>
                      {" / "}
                      <span className="font-mono text-[var(--foreground)]">
                        {formatUnits(matchLiabilityCapWei, decimals)}
                      </span>{" "}
                      PLAY
                    </>
                  ) : null}
                </p>
                {positionQ.data ? (
                  <p className="font-mono text-[11px] text-[var(--muted)]">
                    tokenId{" "}
                    <span className="break-all text-[var(--accent)]">{positionQ.data.tokenId.toString()}</span>
                    <span className="mx-2 text-[var(--border)]">|</span>
                    your balance{" "}
                    <span className="text-[var(--foreground)]">{positionQ.data.balance.toString()}</span> wei
                  </p>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-[var(--muted)]">
                    <span>Stake (PLAY)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={stakePlay}
                      onChange={(e) => setStakePlay(e.target.value)}
                      disabled={busy || !matchOpen}
                      className="rounded-lg border border-[var(--border)]/80 bg-[var(--background)]/80 px-3 py-2 font-mono text-sm text-[var(--foreground)] outline-none ring-[var(--accent)]/30 focus-visible:ring-2 disabled:opacity-50"
                    />
                    {maxStakeWei !== null && maxStakeWei > BigInt(0) ? (
                      <button
                        type="button"
                        disabled={busy || !matchOpen}
                        onClick={() => setStakePlay(formatUnits(maxStakeWei, decimals))}
                        className="w-fit text-left text-[10px] text-[var(--accent)] underline-offset-2 hover:underline"
                      >
                        Max for this script (~{formatUnits(maxStakeWei, decimals)} PLAY)
                      </button>
                    ) : null}
                  </label>
                  {!connected ? (
                    <p className="text-xs text-[var(--muted)]">Connect a wallet on Somnia Testnet.</p>
                  ) : wrongChain ? (
                    <p className="text-xs text-rose-300/90">Switch to Somnia Testnet.</p>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        busy ||
                        !walletClient ||
                        !publicClient ||
                        !matchOpen ||
                        wrongChain ||
                        !lockQuote ||
                        lockQuote.noRoom
                      }
                      onClick={() => setLockModalOpen(true)}
                      className="shrink-0 rounded-lg border border-[var(--accent)]/40 bg-[var(--surface-active)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-[var(--accent)]/55 hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      Review & lock
                    </button>
                  )}
                </div>

                {lockQuoteQ.isPending ? (
                  <p className="text-[10px] text-[var(--muted)]">Loading payout estimate…</p>
                ) : lockQuote && !lockQuote.noRoom ? (
                  <div className="rounded-lg border border-[var(--border)]/50 bg-[var(--background)]/40 px-3 py-2.5 text-[11px] leading-relaxed text-[var(--muted)]">
                    <p className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                      <span>
                        Net stake{" "}
                        <span className="font-mono font-medium text-[var(--foreground)]">
                          {formatUnits(lockQuote.netStakeWei, decimals)}
                        </span>{" "}
                        PLAY
                      </span>
                      <span>
                        Fee 0.5%:{" "}
                        <span className="font-mono text-[var(--foreground)]">
                          {formatUnits(lockQuote.lockFeeWei, decimals)}
                        </span>
                      </span>
                    </p>
                    <p className="mt-1 flex flex-wrap justify-between gap-x-3 gap-y-1">
                      <span>
                        Est. payout if 5/5:{" "}
                        <span className="font-mono font-medium text-emerald-300/95">
                          {formatUnits(lockQuote.payoutIfWinWei, decimals)}
                        </span>{" "}
                        PLAY
                      </span>
                      {lockQuoteQ.data ? (
                        <span>
                          Multiplier{" "}
                          <span className="text-[var(--accent)]">
                            {payoutMultiplierLabel(lockQuoteQ.data.rate)}
                          </span>
                        </span>
                      ) : null}
                    </p>
                    {lockQuote.partialFill ? (
                      <p className="mt-1 text-amber-200/90">
                        Partial fill — only {formatUnits(lockQuote.actualStakeWei, decimals)} PLAY locks;{" "}
                        {formatUnits(lockQuote.refundWei, decimals)} refunded.
                      </p>
                    ) : null}
                  </div>
                ) : lockQuote?.noRoom ? (
                  <p className="text-[10px] text-rose-300/90">No liability room left for new locks on this match.</p>
                ) : null}

                <FixtureLockScriptModal
                  open={lockModalOpen}
                  onClose={() => {
                    if (!busy) setLockModalOpen(false);
                  }}
                  onConfirm={() => void onLockV2()}
                  busy={busy}
                  decimals={decimals}
                  matchId={matchId.toString()}
                  stakeInput={stakePlay}
                  onStakeInputChange={setStakePlay}
                  quote={lockQuote}
                  matchLiabilityWei={matchLiabilityWei}
                  matchLiabilityCapWei={matchLiabilityCapWei}
                  difficultyScore={lockQuoteQ.data?.score ?? null}
                />

                {positionQ.data && positionQ.data.balance > BigInt(0) && matchOpen ? (
                  <button
                    type="button"
                    disabled={busy || !walletClient || !publicClient || wrongChain}
                    onClick={() => void onUnwindMax()}
                    className="w-full rounded-lg border border-[var(--border)]/80 bg-[var(--surface)]/40 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-rose-400/35 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    Unwind full balance (burn ticket, get PLAY back)
                  </button>
                ) : null}

                {matchOpen ? (
                  <p className="text-[10px] leading-relaxed text-[var(--muted)]">
                    Lock is allowed whenever the kernel match is OPEN (not only during the fixture edit
                    window). Unwind returns PLAY while the match stays OPEN.
                  </p>
                ) : null}
                </>
              )}
            </div>
          ) : null
        ) : (
          <p className="mt-2 max-w-xl text-xs text-[var(--muted)]">
            Locking PLAY from this page requires the positions contract to be configured.
          </p>
        )}

        {err ? <p className="mt-2 max-w-xl text-[11px] text-rose-300/90">{err}</p> : null}
        {okMsg ? (
          <p className="mt-2 max-w-xl text-xs font-medium text-emerald-400/95" role="status">
            {okMsg}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="border-t border-[var(--border)] pt-8" aria-label="Onchain match">
      {!canRegister ? (
        <p className="max-w-xl text-sm text-amber-200/85">
          Registration is only available before this fixture goes live or finishes.
        </p>
      ) : !kickoffFuture ? (
        <p className="max-w-xl text-sm text-amber-200/85">
          Kickoff is too soon or already past — onchain registration is disabled.
        </p>
      ) : !connected ? (
        <p className="max-w-xl text-sm text-[var(--muted)]">Connect a wallet on Somnia Testnet.</p>
      ) : wrongChain ? (
        <p className="max-w-xl text-sm text-rose-300/90">Switch your wallet to Somnia Testnet.</p>
      ) : (
        <div className="max-w-md">
          <button
            type="button"
            disabled={busy || !walletClient || !publicClient}
            onClick={() => void onRegister()}
            className="w-full rounded-lg border border-[var(--accent)]/35 bg-[var(--surface-active)] py-2.5 text-sm font-semibold text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-[var(--accent)]/55 hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Confirm in wallet…" : registerMatchButtonLabel(sportKey)}
          </button>
          <p className="mt-2 text-center text-[10px] leading-relaxed text-[var(--muted)]">
            Onchain settlement may begin {formatV2FinalizeDelayLabel(sportKey)} after kickoff.
          </p>
          {err ? (
            <p className="mt-2 text-center text-[11px] leading-snug text-rose-300/90">{err}</p>
          ) : null}
          {okMsg ? (
            <p className="mt-2 text-center text-xs font-medium text-emerald-400/95" role="status">
              {okMsg}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
