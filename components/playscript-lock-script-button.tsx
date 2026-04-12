"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { encodeFunctionData, maxUint256, parseUnits } from "viem";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";

import { usePlayBalance } from "@/hooks/use-play-balance";
import { somniaTestnet } from "@/lib/chains/somnia";
import {
  playTokenReadAbi,
  playTokenWriteAbi,
  playscriptCoreWriteAbi,
} from "@/lib/playscript-onchain-abi";
import { getPlayscriptClientEnv } from "@/lib/playscript-public-env";

type Props = {
  matchId: number;
  picksPacked: bigint | null;
  playStake: string;
  /** Slots complete, positive stake, packed picks valid */
  formReady: boolean;
  canEdit: boolean;
};

function parseStakeWei(playStake: string, decimals: number): bigint {
  const t = playStake.trim().replace(/,/g, "").replace(/\.$/, "");
  if (!t) throw new Error("Enter a stake amount.");
  return parseUnits(t, decimals);
}

export function PlayscriptLockScriptButton({
  matchId,
  picksPacked,
  playStake,
  formReady,
  canEdit,
}: Props) {
  const queryClient = useQueryClient();
  const { address, status, chainId } = useConnection();
  const connected = status === "connected";
  const contracts = useMemo(() => {
    const e = getPlayscriptClientEnv();
    return e.ok ? { playToken: e.playToken, playscriptCore: e.playscriptCore } : null;
  }, []);
  const { data: balData } = usePlayBalance();
  const decimals = balData?.decimals ?? 18;

  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: somniaTestnet.id });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lockedOk, setLockedOk] = useState(false);

  const wrongChain = connected && chainId !== somniaTestnet.id;

  const disabled =
    !canEdit ||
    !formReady ||
    !connected ||
    !address ||
    !walletClient ||
    !publicClient ||
    !contracts ||
    picksPacked === null ||
    wrongChain ||
    busy;

  const onClick = useCallback(async () => {
    setErr(null);
    setLockedOk(false);
    if (picksPacked === null || !address || !walletClient || !publicClient || !contracts) return;

    let stakeWei: bigint;
    try {
      stakeWei = parseStakeWei(playStake, decimals);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Invalid stake");
      return;
    }
    if (stakeWei === BigInt(0)) {
      setErr("Stake must be greater than zero.");
      return;
    }

    const { playToken, playscriptCore } = contracts;

    setBusy(true);
    try {
      const allowance = await publicClient.readContract({
        address: playToken,
        abi: playTokenReadAbi,
        functionName: "allowance",
        args: [address, playscriptCore],
      });

      if (allowance < stakeWei) {
        const hashA = await walletClient.sendTransaction({
          chain: somniaTestnet,
          account: address,
          to: playToken,
          data: encodeFunctionData({
            abi: playTokenWriteAbi,
            functionName: "approve",
            args: [playscriptCore, maxUint256],
          }),
        });
        await publicClient.waitForTransactionReceipt({ hash: hashA });
      }

      const hashL = await walletClient.sendTransaction({
        chain: somniaTestnet,
        account: address,
        to: playscriptCore,
        data: encodeFunctionData({
          abi: playscriptCoreWriteAbi,
          functionName: "lockScript",
          args: [BigInt(matchId), picksPacked, stakeWei],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash: hashL });

      await queryClient.invalidateQueries({ queryKey: ["play-balance-api"] });
      await queryClient.invalidateQueries({ queryKey: ["playscript-user-script"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg.length > 220 ? `${msg.slice(0, 220)}…` : msg);
    } finally {
      setBusy(false);
    }
  }, [
    address,
    contracts,
    decimals,
    matchId,
    picksPacked,
    playStake,
    publicClient,
    queryClient,
    walletClient,
  ]);

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={disabled}
        onClick={() => void onClick()}
        className="w-full rounded-lg bg-[var(--accent)] py-2.5 text-sm font-semibold text-[var(--background)] shadow-[0_1px_0_rgba(255,255,255,0.12)_inset] transition-[filter,opacity] hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:bg-[var(--border)] disabled:text-[var(--muted)] disabled:opacity-70 disabled:shadow-none disabled:hover:brightness-100"
      >
        {busy ? "Confirm in wallet…" : "Lock script"}
      </button>
      {wrongChain && canEdit ? (
        <p className="mt-2 text-center text-[11px] text-rose-300/90">
          Switch your wallet to Somnia Testnet to lock.
        </p>
      ) : null}
      {err ? (
        <p className="mt-2 text-center text-[11px] leading-snug text-rose-300/90">{err}</p>
      ) : null}
      {lockedOk ? (
        <p
          className="mt-2 text-center text-xs font-medium text-emerald-400/95"
          role="status"
        >
          Script locked on-chain. Your balance and match view will update in a moment.
        </p>
      ) : null}
    </div>
  );
}
