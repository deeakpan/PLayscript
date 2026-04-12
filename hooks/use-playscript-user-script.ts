"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useConnection } from "wagmi";

import { getPlayscriptClientEnv } from "@/lib/playscript-public-env";

export type UserScriptSlotPick = { label: string; value: string };

export type LockedUserScript = {
  scriptId: string;
  matchId: string;
  owner: string;
  stake: string;
  stakeFormatted: string;
  decimals: number;
  picksPacked: string;
  choicesReceipt: string;
  claimed: boolean;
  slotPicks: UserScriptSlotPick[];
};

export type UserScriptOkResponse =
  | {
      ok: true;
      hasScript: false;
      matchSettled: boolean;
      sportIndex: number;
      script: null;
    }
  | {
      ok: true;
      hasScript: true;
      matchSettled: boolean;
      sportIndex: number;
      script: LockedUserScript;
    };

export function usePlayscriptUserScript(matchId: number | null) {
  const { address, status } = useConnection();
  const connected = status === "connected";
  const env = useMemo(() => getPlayscriptClientEnv(), []);

  return useQuery({
    queryKey: ["playscript-user-script", env.ok ? env.playscriptCore : null, matchId, address],
    enabled: env.ok && connected && !!address && matchId !== null,
    queryFn: async (): Promise<UserScriptOkResponse> => {
      const r = await fetch(
        `/api/playscript/user-script?address=${encodeURIComponent(address!)}&matchId=${String(matchId)}`,
        { cache: "no-store" },
      );
      const j = (await r.json()) as {
        ok?: boolean;
        error?: string;
        hasScript?: boolean;
        matchSettled?: boolean;
        sportIndex?: number;
        script?: LockedUserScript | null;
      };
      if (!r.ok || !j.ok) {
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      const matchSettled = Boolean(j.matchSettled);
      const sportIndex = typeof j.sportIndex === "number" ? j.sportIndex : 0;
      if (j.hasScript === true && j.script) {
        return {
          ok: true,
          hasScript: true,
          matchSettled,
          sportIndex,
          script: j.script,
        };
      }
      return {
        ok: true,
        hasScript: false,
        matchSettled,
        sportIndex,
        script: null,
      };
    },
    staleTime: 15_000,
  });
}
