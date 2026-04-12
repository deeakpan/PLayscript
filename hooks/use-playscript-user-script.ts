"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useConnection } from "wagmi";

import { getPlayscriptClientEnv } from "@/lib/playscript-public-env";

export type UserScriptSlotPick = { label: string; value: string };

export type SettlementInfo = {
  finalizeAtUnix: number;
  chainNowUnix: number;
  settlementWindowOpen: boolean;
};

export type GradingRow = { label: string; yourPick: string; result: string; correct: boolean };

export type GradingInfo = {
  correctSlots: number;
  rows: GradingRow[];
  finalHome: string;
  finalAway: string;
};

export type ClaimInfo = {
  winner: boolean;
  tierLabel: string;
  mintUserFormatted: string;
  mintFeeFormatted: string;
  mintUserWei: string;
  mintFeeWei: string;
  showClaimButton: boolean;
};

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
      settlement: SettlementInfo;
      script: null;
    }
  | {
      ok: true;
      hasScript: true;
      matchSettled: boolean;
      sportIndex: number;
      settlement: SettlementInfo;
      grading: GradingInfo | null;
      claim: ClaimInfo | null;
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
        settlement?: SettlementInfo;
        grading?: GradingInfo | null;
        claim?: ClaimInfo | null;
        script?: LockedUserScript | null;
      };
      if (!r.ok || !j.ok) {
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      const matchSettled = Boolean(j.matchSettled);
      const sportIndex = typeof j.sportIndex === "number" ? j.sportIndex : 0;
      const settlement = j.settlement ?? {
        finalizeAtUnix: 0,
        chainNowUnix: 0,
        settlementWindowOpen: false,
      };

      if (j.hasScript === true && j.script) {
        return {
          ok: true,
          hasScript: true,
          matchSettled,
          sportIndex,
          settlement,
          grading: j.grading ?? null,
          claim: j.claim ?? null,
          script: j.script,
        };
      }
      return {
        ok: true,
        hasScript: false,
        matchSettled,
        sportIndex,
        settlement,
        script: null,
      };
    },
    staleTime: 15_000,
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d || d.hasScript === false) return false;
      const { settlement, matchSettled, script } = d;
      if (!settlement.settlementWindowOpen) return false;
      if (!matchSettled) return 12_000;
      if (!script.claimed) return 12_000;
      return false;
    },
  });
}
