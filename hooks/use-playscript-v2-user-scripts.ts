"use client";

import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";

import { getPlayscriptV2LockRegistryEnv } from "@/lib/playscript-public-env";
import { getPlayscriptV2SubgraphUrl, playscriptV2HistoryConfigured } from "@/lib/playscript-v2-subgraph";

export type V2UserScriptListRow = {
  lockId: string;
  matchId: string;
  legMask12: number;
  netStake: string;
  netStakeFormatted: string;
  actualStakeFormatted: string;
  payoutRate: string;
  blockTimestamp: string;
  transactionHash: string;
  matchUrl: string;
  matchSettled: boolean;
  sportIndex: number;
  eventId: string | null;
  sourceLeagueId: string | null;
  claimed: boolean;
  payoutFormatted: string | null;
  homeTeam: string;
  awayTeam: string;
  pickDescriptions: { legId: number; description: string; difficulty: string }[];
  picksPlainText: string;
};

export { playscriptV2HistoryConfigured as playscriptV2SubgraphConfigured } from "@/lib/playscript-v2-subgraph";

export type V2UserScriptsQueryData = {
  scripts: V2UserScriptListRow[];
  indexing: boolean;
};

export function usePlayscriptV2UserScripts() {
  const registryEnv = getPlayscriptV2LockRegistryEnv();
  const subgraphUrl = getPlayscriptV2SubgraphUrl();
  const historyOk = registryEnv.ok || !!subgraphUrl;
  const { address, status } = useConnection();
  const connected = status === "connected";

  return useQuery({
    queryKey: [
      "playscript-v2-user-scripts",
      registryEnv.ok ? registryEnv.lockRegistry : null,
      subgraphUrl,
      address,
    ],
    enabled: historyOk && connected && !!address,
    queryFn: async (): Promise<V2UserScriptsQueryData> => {
      const r = await fetch(
        `/api/playscript/v2-user-scripts?address=${encodeURIComponent(address!)}`,
        { cache: "no-store" },
      );
      const j = (await r.json()) as {
        ok?: boolean;
        error?: string;
        scripts?: V2UserScriptListRow[];
        indexing?: boolean;
      };
      if (!r.ok || !j.ok) {
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      return { scripts: j.scripts ?? [], indexing: j.indexing === true };
    },
    staleTime: 20_000,
    refetchInterval: (query) => (query.state.data?.indexing ? 15_000 : false),
  });
}
