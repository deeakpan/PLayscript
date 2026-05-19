"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useConnection, usePublicClient } from "wagmi";

import { somniaTestnet } from "@/lib/chains/somnia";
import type { ScriptSportKey } from "@/lib/fixtures-shared";
import { formatPlayAmount } from "@/lib/format-play-display";
import { v2GradingFactsFromScores } from "@/lib/playscript-v2-grading";
import {
  allV2FivePickMasks,
  gradeV2LegMaskPicks,
  v2RegisteredLegKindsDifferFromCurrentMarket,
} from "@/lib/playscript-v2-legs";
import { fetchV2UserLocksFromRegistry } from "@/lib/playscript-v2-lock-registry-read";
import { readKernelMatch } from "@/lib/playscript-v2-kernel-read";
import { playscriptKernelReadAbi } from "@/lib/playscript-v2-kernel-abi";
import {
  getPlayscriptV2KernelEnv,
  getPlayscriptV2LockRegistryEnv,
  getPlayscriptV2PositionsEnv,
} from "@/lib/playscript-public-env";
import { playscriptV2PositionsReadAbi } from "@/lib/playscript-v2-positions-abi";

export type PlayscriptV2FixtureScript =
  | {
      hasScript: true;
      legMask12: number;
      netStakeWei: bigint;
      balance: bigint;
      claimed: boolean;
      correctCount: number;
      totalPicks: number;
      picks: ReturnType<typeof gradeV2LegMaskPicks>["picks"];
      stakeFormatted: string;
      settled: boolean;
      settleInProgress: boolean;
      matchOpen: boolean;
      isWinner: boolean | null;
      payoutFormatted: string | null;
      htScoreLabel: string | null;
      finalScoreLabel: string | null;
      usesLegacyLegBoard: boolean;
    }
  | { hasScript: false };

type Args = {
  matchId: bigint | null;
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  sportKey: ScriptSportKey;
  decimals: number;
  /** Live ESPN line — enables in-play ticks on your script card. */
  liveHomeScore?: number;
  liveAwayScore?: number;
  /** Fixture display status is finished (grade from scoreline before onchain settle). */
  matchEnded?: boolean;
};

export function usePlayscriptV2FixtureScript({
  matchId,
  fixtureId,
  homeTeam,
  awayTeam,
  sportKey,
  decimals,
  liveHomeScore,
  liveAwayScore,
  matchEnded = false,
}: Args) {
  const { address, status } = useConnection();
  const connected = status === "connected";
  const publicClient = usePublicClient({ chainId: somniaTestnet.id });
  const kernelEnv = useMemo(() => getPlayscriptV2KernelEnv(), []);
  const positionsEnv = useMemo(() => getPlayscriptV2PositionsEnv(), []);
  const registryEnv = useMemo(() => getPlayscriptV2LockRegistryEnv(), []);

  return useQuery({
    queryKey: [
      "v2-fixture-script",
      matchId?.toString() ?? null,
      address ?? null,
      fixtureId,
      kernelEnv.ok ? kernelEnv.kernel : null,
      positionsEnv.ok ? positionsEnv.positions : null,
      registryEnv.ok ? registryEnv.lockRegistry : null,
      liveHomeScore ?? null,
      liveAwayScore ?? null,
      matchEnded,
    ],
    enabled:
      connected &&
      !!address &&
      !!publicClient &&
      matchId !== null &&
      kernelEnv.ok &&
      positionsEnv.ok,
    refetchInterval: (query) => {
      const d = query.state.data;
      if (d?.hasScript === true && !d.settled) return 12_000;
      return 20_000;
    },
    queryFn: async (): Promise<PlayscriptV2FixtureScript> => {
      if (!address || !publicClient || matchId === null || !kernelEnv.ok || !positionsEnv.ok) {
        return { hasScript: false };
      }

      let legMask12: number | null = null;
      let netStakeWei = BigInt(0);
      let claimed = false;

      if (registryEnv.ok) {
        const locks = await fetchV2UserLocksFromRegistry(registryEnv.lockRegistry, address);
        const forMatch = locks.filter((l) => l.matchId === matchId);
        const active = forMatch.find((l) => !l.claimed) ?? forMatch[forMatch.length - 1];
        if (active) {
          legMask12 = active.legMask12;
          netStakeWei = active.netStake;
          claimed = active.claimed;
        }
      }

      const masksToTry =
        legMask12 !== null ? [legMask12] : (allV2FivePickMasks() as number[]);

      let balance = BigInt(0);
      let resolvedMask = legMask12;

      for (const mask of masksToTry) {
        const tokenId = await publicClient.readContract({
          address: positionsEnv.positions,
          abi: playscriptV2PositionsReadAbi,
          functionName: "scriptTokenId",
          args: [matchId, mask],
        });
        const bal = await publicClient.readContract({
          address: positionsEnv.positions,
          abi: playscriptV2PositionsReadAbi,
          functionName: "balanceOf",
          args: [address, tokenId],
        });
        if (bal > BigInt(0)) {
          balance = bal;
          resolvedMask = mask;
          break;
        }
      }

      if (balance <= BigInt(0) || resolvedMask === null) {
        return { hasScript: false };
      }

      const match = await readKernelMatch(publicClient, kernelEnv.kernel, matchId);
      const registeredLegKinds =
        match.legKinds.length === 15 ? match.legKinds : undefined;

      const hasLiveLine =
        typeof liveHomeScore === "number" &&
        typeof liveAwayScore === "number" &&
        Number.isFinite(liveHomeScore) &&
        Number.isFinite(liveAwayScore);

      const liveFacts = hasLiveLine
        ? v2GradingFactsFromScores(liveHomeScore, liveAwayScore)
        : null;

      const { picks, correctCount, totalPicks } = gradeV2LegMaskPicks(
        fixtureId,
        homeTeam,
        awayTeam,
        sportKey,
        resolvedMask,
        match.resolvedLegsBitmask,
        match.settled,
        registeredLegKinds,
        liveFacts
          ? {
              sport: match.sport,
              facts: liveFacts,
              matchEnded: matchEnded || match.settled,
            }
          : undefined,
      );

      let isWinner: boolean | null = null;
      let payoutFormatted: string | null = null;
      if (match.settled) {
        isWinner = await publicClient.readContract({
          address: kernelEnv.kernel,
          abi: playscriptKernelReadAbi,
          functionName: "isWinningMask",
          args: [matchId, resolvedMask],
        });
        if (isWinner) {
          const rate = await publicClient.readContract({
            address: kernelEnv.kernel,
            abi: playscriptKernelReadAbi,
            functionName: "payoutRateForMask",
            args: [matchId, resolvedMask],
          });
          const payoutWei = (netStakeWei * rate) / BigInt(10);
          payoutFormatted = formatPlayAmount(payoutWei, decimals);
        }
      }

      const usesLegacyLegBoard =
        registeredLegKinds !== undefined &&
        v2RegisteredLegKindsDifferFromCurrentMarket(sportKey, registeredLegKinds);

      return {
        hasScript: true,
        legMask12: resolvedMask,
        netStakeWei,
        balance,
        claimed,
        picks,
        correctCount,
        totalPicks,
        stakeFormatted: formatPlayAmount(netStakeWei, decimals),
        settled: match.settled,
        settleInProgress: match.settleInProgress,
        matchOpen: match.state === 0,
        isWinner,
        payoutFormatted,
        htScoreLabel: match.settled
          ? `${match.htHome.toString()}–${match.htAway.toString()} (HT)`
          : null,
        finalScoreLabel: match.settled
          ? `${match.finalHome.toString()}–${match.finalAway.toString()} (FT)`
          : null,
        usesLegacyLegBoard,
      };
    },
  });
}
