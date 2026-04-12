"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { encodeFunctionData } from "viem";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";

import { somniaTestnet } from "@/lib/chains/somnia";
import { playscriptCoreWriteAbi } from "@/lib/playscript-onchain-abi";
import { getPlayscriptClientEnv } from "@/lib/playscript-public-env";

type Props = {
  scriptId: string;
  disabled?: boolean;
};

export function PlayscriptClaimPayoutButton({ scriptId, disabled }: Props) {
  const queryClient = useQueryClient();
  const { address, status, chainId } = useConnection();
  const connected = status === "connected";
  const contracts = useMemo(() => {
    const e = getPlayscriptClientEnv();
    return e.ok ? { playscriptCore: e.playscriptCore } : null;
  }, []);

  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: somniaTestnet.id });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const wrongChain = connected && chainId !== somniaTestnet.id;

  const btnDisabled =
    disabled ||
    !connected ||
    !address ||
    !walletClient ||
    !publicClient ||
    !contracts ||
    wrongChain ||
    busy;

  const onClick = useCallback(async () => {
    setErr(null);
    if (!address || !walletClient || !publicClient || !contracts) return;

    setBusy(true);
    try {
      const hash = await walletClient.sendTransaction({
        chain: somniaTestnet,
        account: address,
        to: contracts.playscriptCore,
        data: encodeFunctionData({
          abi: playscriptCoreWriteAbi,
          functionName: "claimPayout",
          args: [BigInt(scriptId)],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash });

      await queryClient.invalidateQueries({ queryKey: ["play-balance-api"] });
      await queryClient.invalidateQueries({ queryKey: ["playscript-user-script"] });
      await queryClient.invalidateQueries({ queryKey: ["playscript-user-scripts"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg.length > 220 ? `${msg.slice(0, 220)}…` : msg);
    } finally {
      setBusy(false);
    }
  }, [address, contracts, publicClient, queryClient, scriptId, walletClient]);

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={btnDisabled}
        onClick={() => void onClick()}
        className="w-full rounded-lg bg-[var(--accent)] py-2 text-sm font-semibold text-[var(--background)] shadow-[0_1px_0_rgba(255,255,255,0.12)_inset] transition-[filter,opacity] hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:bg-[var(--border)] disabled:text-[var(--muted)] disabled:opacity-70 disabled:shadow-none disabled:hover:brightness-100"
      >
        {busy ? "Confirm in wallet…" : "Claim payout"}
      </button>
      {wrongChain ? (
        <p className="mt-1.5 text-center text-[10px] text-rose-300/90">
          Switch your wallet to Somnia Testnet to claim.
        </p>
      ) : null}
      {err ? (
        <p className="mt-1.5 text-center text-[10px] leading-snug text-rose-300/90">{err}</p>
      ) : null}
    </div>
  );
}
