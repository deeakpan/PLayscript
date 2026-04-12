"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useConnection } from "wagmi";

import { getPlayscriptClientEnv } from "@/lib/playscript-public-env";

export type PlayBalanceData = {
  raw: bigint;
  decimals: number;
};

export function usePlayBalance() {
  const { address, status } = useConnection();
  const connected = status === "connected";
  const env = useMemo(() => getPlayscriptClientEnv(), []);

  const q = useQuery({
    queryKey: ["play-balance-api", env.ok ? env.playToken : null, address],
    enabled: env.ok && connected && !!address,
    queryFn: async () => {
      const r = await fetch(
        `/api/playscript/play-balance?address=${encodeURIComponent(address!)}`,
        { cache: "no-store" },
      );
      const j = (await r.json()) as {
        ok?: boolean;
        balance?: string;
        decimals?: number;
        error?: string;
      };
      if (!r.ok || !j.ok || j.balance === undefined) {
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      const decimals =
        typeof j.decimals === "number" &&
        Number.isFinite(j.decimals) &&
        j.decimals >= 0 &&
        j.decimals <= 36
          ? j.decimals
          : 18;
      return {
        raw: BigInt(j.balance),
        decimals,
      } satisfies PlayBalanceData;
    },
    refetchInterval: 25_000,
  });

  return {
    connected,
    address,
    envOk: env.ok,
    data: q.data,
    isPending: q.isPending,
    isFetching: q.isFetching,
    isError: q.isError,
    error: q.error,
  };
}
