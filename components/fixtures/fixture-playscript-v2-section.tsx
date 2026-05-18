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
import {
  bitmaskPopcount,
  describeV2LegMaskPicks,
  V2_MASK_MAX,
  V2_PICK_COUNT,
} from "@/lib/playscript-v2-legs";
import { formatPlayAmount } from "@/lib/format-play-display";
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
  /** Current 15-bit leg mask from `PlayscriptV2LegBuilder` (exactly five bits set when ready). */
  legMask12: number;
  /** When the user already has a locked script, hide stake / Continue (shown in `FixtureV2LockedScript`). */
  hideLockForm?: boolean;
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
  hideLockForm = false,
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

  const selectionLines = useMemo(
    () =>
      describeV2LegMaskPicks(fixtureId, homeTeam, awayTeam, sportKey, legMaskNorm).map(
        (p) => p.description,
      ),
    [fixtureId, homeTeam, awayTeam, sportKey, legMaskNorm],
  );

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
            [...registerArgs.legKinds],
            [...registerArgs.legWeights],
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
      await queryClient.invalidateQueries({ queryKey: ["v2-fixture-script"] });
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
    if (hideLockForm) {
      return null;
    }

    return (
      <section className="border-t border-[var(--border)] pt-8" aria-label="Lock script">
        {positionsEnv.ok ? (
          maskReady ? (
            <div className="mt-4 max-w-sm space-y-3 rounded-xl border border-[var(--border)]/70 bg-[var(--surface)]/20 p-4">
              {chainMatchQ.isPending ? (
                <FixturePlayscriptInlineSpinner label="Loading…" />
              ) : chainMatchQ.isError ? (
                <p className="text-xs text-rose-300/90">Could not load match. Try again shortly.</p>
              ) : !matchOpen ? (
                <p className="text-sm text-amber-200/90">Staking is closed for this match.</p>
              ) : !connected ? (
                <p className="text-sm text-[var(--muted)]">Connect your wallet on Somnia Testnet to stake.</p>
              ) : wrongChain ? (
                <p className="text-sm text-rose-300/90">Switch your wallet to Somnia Testnet.</p>
              ) : (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-[var(--muted)]">Stake ($PLAY)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={stakePlay}
                      onChange={(e) => setStakePlay(e.target.value)}
                      disabled={busy}
                      className="rounded-lg border border-[var(--border)]/80 bg-[var(--background)]/80 px-3 py-2.5 text-sm tabular-nums text-[var(--foreground)] outline-none ring-[var(--accent)]/30 focus-visible:ring-2 disabled:opacity-50"
                    />
                    {maxStakeWei !== null && maxStakeWei > BigInt(0) ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setStakePlay(formatPlayAmount(maxStakeWei, decimals))}
                        className="w-fit text-left text-[11px] text-[var(--accent)] underline-offset-2 hover:underline"
                      >
                        Max · {formatPlayAmount(maxStakeWei, decimals)} PLAY
                      </button>
                    ) : null}
                  </label>

                  {lockQuoteQ.isPending ? (
                    <p className="text-xs text-[var(--muted)]">Updating estimate…</p>
                  ) : lockQuote?.noRoom ? (
                    <p className="text-xs text-rose-300/90">This match is full — try a lower stake later.</p>
                  ) : lockQuote ? (
                    <div className="space-y-1 text-sm">
                      <p className="flex justify-between gap-2">
                        <span className="text-[var(--muted)]">Potential payout (5/5)</span>
                        <span className="shrink-0 font-semibold tabular-nums text-emerald-300/95">
                          {formatPlayAmount(lockQuote.payoutIfWinWei, decimals)} PLAY
                        </span>
                      </p>
                      {lockQuoteQ.data ? (
                        <p className="flex justify-between gap-2">
                          <span className="text-[var(--muted)]">Multiplier</span>
                          <span className="shrink-0 font-semibold text-[var(--accent)]">
                            {payoutMultiplierLabel(lockQuoteQ.data.rate)}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    disabled={busy || !walletClient || !publicClient || !lockQuote || lockQuote.noRoom}
                    onClick={() => setLockModalOpen(true)}
                    className="w-full rounded-lg border border-[var(--accent)]/40 bg-[var(--surface-active)] py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/55 hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    Continue
                  </button>

                  <FixtureLockScriptModal
                    open={lockModalOpen}
                    onClose={() => {
                      if (!busy) setLockModalOpen(false);
                    }}
                    onConfirm={() => void onLockV2()}
                    busy={busy}
                    decimals={decimals}
                    quote={lockQuote}
                    selections={selectionLines}
                    kickoffUtc={kickoffUtc}
                  />

                  {positionQ.data && positionQ.data.balance > BigInt(0) ? (
                    <button
                      type="button"
                      disabled={busy || !walletClient || !publicClient || wrongChain}
                      onClick={() => void onUnwindMax()}
                      className="w-full py-1.5 text-xs font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--foreground)] hover:underline disabled:opacity-50"
                    >
                      Withdraw position
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : null
        ) : (
          <p className="mt-2 max-w-sm text-xs text-[var(--muted)]">
            Staking is not configured for this deployment.
          </p>
        )}

        {err ? <p className="mt-2 max-w-sm text-xs text-rose-300/90">{err}</p> : null}
        {okMsg ? (
          <p className="mt-2 max-w-sm text-xs font-medium text-emerald-400/95" role="status">
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
