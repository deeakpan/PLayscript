"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useConnection } from "wagmi";

import { getPlayscriptClientEnv } from "@/lib/playscript-public-env";

export type UserScriptListRow = {
  scriptId: string;
  matchId: string;
  picksPacked: string;
  choicesReceipt: string;
  sportIndex: number;
  stake: string;
  stakeFormatted: string;
  decimals: number;
  claimed: boolean;
  matchExists: boolean;
  matchSettled: boolean;
  matchUrl: string;
  eventId: string | null;
  /** TheSportsDB `idLeague` when resolved from fixture feed — for `?league=` on fixture links. */
  sourceLeagueId: string | null;
  homeTeam: string;
  awayTeam: string;
};

export function usePlayscriptUserScripts() {
  const { address, status } = useConnection();
  const connected = status === "connected";
  const env = useMemo(() => getPlayscriptClientEnv(), []);

  return useQuery({
    queryKey: ["playscript-user-scripts", env.ok ? env.playscriptCore : null, address],
    enabled: env.ok && connected && !!address,
    queryFn: async (): Promise<UserScriptListRow[]> => {
      const r = await fetch(
        `/api/playscript/user-scripts?address=${encodeURIComponent(address!)}`,
        { cache: "no-store" },
      );
      const j = (await r.json()) as {
        ok?: boolean;
        error?: string;
        scripts?: (Omit<UserScriptListRow, "sourceLeagueId"> & { sourceLeagueId?: string | null })[];
      };
      if (!r.ok || !j.ok) {
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      const list = j.scripts ?? [];
      return list.map((row) => ({
        ...row,
        sourceLeagueId: row.sourceLeagueId ?? null,
      }));
    },
    staleTime: 20_000,
  });
}
