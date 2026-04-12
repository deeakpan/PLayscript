"use client";

import { useQuery } from "@tanstack/react-query";

import { getPlayscriptClientEnv } from "@/lib/playscript-public-env";

export { normalizeMatchUrl } from "@/lib/playscript-match-url";

export function usePlayscriptMatchByUrl(candidateUrl: string | null) {
  const env = getPlayscriptClientEnv();

  return useQuery({
    queryKey: ["playscript-match-url", env.ok ? env.playscriptCore : null, candidateUrl],
    enabled: env.ok && !!candidateUrl && candidateUrl.length > 0,
    queryFn: async () => {
      if (!env.ok || !candidateUrl) return { matchId: null as bigint | null };
      const r = await fetch(
        `/api/playscript/resolve-match?url=${encodeURIComponent(candidateUrl)}`,
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
