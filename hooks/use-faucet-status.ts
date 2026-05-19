"use client";

import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";

export type FaucetStatusData = {
  dailyAmountPlay: string;
  canClaim: boolean;
  lastClaimDay: string | null;
  nextClaimAt: string | null;
  balance: string;
  decimals: number;
};

export const FAUCET_STATUS_QUERY_KEY = "faucet-status";

export function faucetStatusQueryKey(address: string | undefined) {
  return [FAUCET_STATUS_QUERY_KEY, address ?? null] as const;
}

export function useFaucetStatus(enabled = true) {
  const { address, status } = useConnection();
  const connected = status === "connected";

  return useQuery({
    queryKey: faucetStatusQueryKey(address),
    enabled: enabled && connected && !!address,
    queryFn: async (): Promise<FaucetStatusData> => {
      const res = await fetch(
        `/api/faucet/status?address=${encodeURIComponent(address!)}`,
        { cache: "no-store" },
      );
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        dailyAmountPlay?: string;
        canClaim?: boolean;
        lastClaimDay?: string | null;
        nextClaimAt?: string | null;
        balance?: string;
        decimals?: number;
      };
      if (!res.ok || !j.ok) {
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      return {
        dailyAmountPlay: j.dailyAmountPlay ?? "100",
        canClaim: Boolean(j.canClaim),
        lastClaimDay: j.lastClaimDay ?? null,
        nextClaimAt: j.nextClaimAt ?? null,
        balance: j.balance ?? "0",
        decimals: j.decimals ?? 18,
      };
    },
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });
}
