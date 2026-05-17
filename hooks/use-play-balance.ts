"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useConnection, useReadContracts } from "wagmi";

import { somniaTestnet } from "@/lib/chains/somnia";
import { getPlayTokenEnv } from "@/lib/playscript-public-env";
import { playTokenReadAbi } from "@/lib/playscript-onchain-abi";

/** Wagmi `useReadContracts` scope — use `invalidatePlayBalance` after PLAY-moving txs. */
export const PLAY_BALANCE_SCOPE = "play-balance";

export type PlayBalanceData = {
  raw: bigint;
  decimals: number;
};

export function usePlayBalance() {
  const { address, status } = useConnection();
  const connected = status === "connected";
  const env = useMemo(() => getPlayTokenEnv(), []);

  const contracts = useMemo(() => {
    if (!env.ok || !address) return [];
    return [
      {
        address: env.playToken,
        abi: playTokenReadAbi,
        functionName: "balanceOf" as const,
        args: [address] as const,
        chainId: somniaTestnet.id,
      },
      {
        address: env.playToken,
        abi: playTokenReadAbi,
        functionName: "decimals" as const,
        chainId: somniaTestnet.id,
      },
    ];
  }, [env, address]);

  const q = useReadContracts({
    contracts,
    scopeKey: PLAY_BALANCE_SCOPE,
    query: {
      enabled: env.ok && connected && !!address,
      refetchInterval: 25_000,
    },
  });

  const data = useMemo((): PlayBalanceData | undefined => {
    const bal = q.data?.[0];
    const dec = q.data?.[1];
    if (bal?.status !== "success" || dec?.status !== "success") return undefined;
    const raw = bal.result;
    const decimals = Number(dec.result);
    return {
      raw: typeof raw === "bigint" ? raw : BigInt(raw),
      decimals: Number.isFinite(decimals) && decimals >= 0 && decimals <= 36 ? decimals : 18,
    };
  }, [q.data]);

  return {
    connected,
    address,
    envOk: env.ok,
    data,
    isPending: q.isPending,
    isFetching: q.isFetching,
    isError: q.isError,
    error: q.error,
    refetch: q.refetch,
  };
}

export async function invalidatePlayBalance(queryClient: QueryClient) {
  await queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[1];
      return (
        query.queryKey[0] === "readContracts" &&
        typeof key === "object" &&
        key !== null &&
        "scopeKey" in key &&
        key.scopeKey === PLAY_BALANCE_SCOPE
      );
    },
  });
}
