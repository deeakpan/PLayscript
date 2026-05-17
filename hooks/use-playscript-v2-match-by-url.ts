"use client";

import { useQuery } from "@tanstack/react-query";

import { getPlayscriptV2KernelEnv } from "@/lib/playscript-public-env";

export function usePlayscriptV2MatchByUrl(candidateUrl: string | null) {
  const env = getPlayscriptV2KernelEnv();

  return useQuery({
    queryKey: ["playscript-v2-match-url", env.ok ? env.kernel : null, candidateUrl],
    enabled: env.ok && !!candidateUrl && candidateUrl.length > 0,
    queryFn: async () => {
      if (!env.ok || !candidateUrl) return { matchId: null as bigint | null };
      const r = await fetch(
        `/api/playscript/resolve-v2-match?url=${encodeURIComponent(candidateUrl)}`,
        { cache: "no-store" },
      );
      const j = (await r.json()) as {
        ok?: boolean;
        matchId?: string | null;
        error?: string;
      };
      if (!r.ok || !j.ok) {
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      return {
        matchId: j.matchId === null || j.matchId === undefined ? null : BigInt(j.matchId),
      };
    },
    staleTime: 20_000,
  });
}
