import { nextUtcDayStartIso, utcDayKey } from "@/lib/faucet/constants";
import type { FaucetStatusData } from "@/hooks/use-faucet-status";

export type FaucetClaimOk = {
  ok: true;
  txHash: string;
  amountPlay: string;
  balance: string;
  decimals: number;
};

export type FaucetClaimErr = {
  ok: false;
  error: string;
  code?: string;
  nextClaimAt?: string | null;
  status: number;
};

export async function postFaucetClaim(address: string): Promise<FaucetClaimOk | FaucetClaimErr> {
  const res = await fetch("/api/faucet/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  const j = (await res.json()) as Record<string, unknown>;
  if (res.ok && j.ok === true) {
    return {
      ok: true,
      txHash: String(j.txHash ?? ""),
      amountPlay: String(j.amountPlay ?? "100"),
      balance: String(j.balance ?? "0"),
      decimals: Number(j.decimals ?? 18),
    };
  }
  return {
    ok: false,
    error: String(j.error ?? `Claim failed (${res.status})`),
    code: typeof j.code === "string" ? j.code : undefined,
    nextClaimAt: typeof j.nextClaimAt === "string" ? j.nextClaimAt : null,
    status: res.status,
  };
}

export function patchFaucetStatusAfterClaim(
  prev: FaucetStatusData | undefined,
  balance: string,
  decimals: number,
): FaucetStatusData {
  const today = utcDayKey();
  return {
    dailyAmountPlay: prev?.dailyAmountPlay ?? "100",
    canClaim: false,
    lastClaimDay: today,
    nextClaimAt: nextUtcDayStartIso(today),
    balance,
    decimals,
  };
}

export const SOMNIA_EXPLORER_TX = "https://shannon-explorer.somnia.network/tx/";
