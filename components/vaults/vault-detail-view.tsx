"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { encodeFunctionData, formatUnits, isAddress, maxUint256, parseUnits } from "viem";
import { useConnection, usePublicClient, useWalletClient } from "wagmi";

import { somniaTestnet } from "@/lib/chains/somnia";
import { playVaultReadAbi, playVaultWriteAbi } from "@/lib/play-vault-abi";
import { playTokenReadAbi, playTokenWriteAbi } from "@/lib/playscript-onchain-abi";
import { invalidatePlayBalance } from "@/hooks/use-play-balance";
import { VaultManageLiquidityModal } from "@/components/vaults/vault-manage-liquidity-modal";
import { VaultUtilizationPie } from "@/components/vaults/vault-utilization-pie";

type Props = { vaultAddress: `0x${string}` };

function displayPlayAmount(raw: string): string {
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) return raw;
  if (Math.abs(n) >= 1_000_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function VaultDetailView({ vaultAddress }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <p className="text-sm text-[var(--muted)]">Loading vault…</p>;
  }

  return <VaultDetailViewInner vaultAddress={vaultAddress} />;
}

function VaultDetailViewInner({ vaultAddress }: Props) {
  const { address, status, chainId } = useConnection();
  const connected = status === "connected";
  const wrongChain = connected && chainId !== somniaTestnet.id;
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: somniaTestnet.id });
  const queryClient = useQueryClient();

  const [depositStr, setDepositStr] = useState("10");
  const [withdrawStr, setWithdrawStr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [liquidityModalOpen, setLiquidityModalOpen] = useState(false);
  const [liquidityMode, setLiquidityMode] = useState<"add" | "remove">("add");

  const playQ = useQuery({
    queryKey: ["play-vault-play", vaultAddress],
    enabled: !!publicClient && isAddress(vaultAddress),
    queryFn: async () => {
      if (!publicClient) throw new Error("no client");
      const token = await publicClient.readContract({
        address: vaultAddress,
        abi: playVaultReadAbi,
        functionName: "PLAY",
      });
      return token as `0x${string}`;
    },
    staleTime: 60_000,
  });
  const playToken = playQ.data;

  const decQ = useQuery({
    queryKey: ["play-token-decimals", playToken],
    enabled: !!publicClient && !!playToken,
    queryFn: async () => {
      if (!publicClient || !playToken) throw new Error("no");
      return publicClient.readContract({
        address: playToken,
        abi: playTokenReadAbi,
        functionName: "decimals",
      });
    },
    staleTime: 3600_000,
  });
  const decimals = typeof decQ.data === "number" ? decQ.data : 18;

  const statsQ = useQuery({
    queryKey: ["play-vault-stats", vaultAddress, playToken ?? null],
    enabled: !!publicClient && !!playToken,
    refetchInterval: 20_000,
    queryFn: async () => {
      if (!publicClient || !playToken) throw new Error("no");
      const [
        totalOutstandingLiability,
        totalShares,
        freeFloat,
        hardFloorBps,
        ledger,
        positions,
        owner,
        vaultPlayBal,
      ] = await Promise.all([
        publicClient.readContract({
          address: vaultAddress,
          abi: playVaultReadAbi,
          functionName: "totalOutstandingLiability",
        }),
        publicClient.readContract({
          address: vaultAddress,
          abi: playVaultReadAbi,
          functionName: "totalShares",
        }),
        publicClient.readContract({
          address: vaultAddress,
          abi: playVaultReadAbi,
          functionName: "freeFloat",
        }),
        publicClient.readContract({
          address: vaultAddress,
          abi: playVaultReadAbi,
          functionName: "HARD_FLOOR_BPS",
        }),
        publicClient.readContract({
          address: vaultAddress,
          abi: playVaultReadAbi,
          functionName: "ledger",
        }),
        publicClient.readContract({
          address: vaultAddress,
          abi: playVaultReadAbi,
          functionName: "positions",
        }),
        publicClient.readContract({
          address: vaultAddress,
          abi: playVaultReadAbi,
          functionName: "owner",
        }),
        publicClient.readContract({
          address: playToken,
          abi: playTokenReadAbi,
          functionName: "balanceOf",
          args: [vaultAddress],
        }),
      ]);
      return {
        totalOutstandingLiability,
        totalShares,
        freeFloat,
        hardFloorBps,
        ledger: ledger as `0x${string}`,
        positions: positions as `0x${string}`,
        owner: owner as `0x${string}`,
        vaultPlayBal,
      };
    },
  });

  const walletPlayQ = useQuery({
    queryKey: ["wallet-play-balance", playToken, address ?? null],
    enabled: !!publicClient && !!playToken && !!address,
    refetchInterval: 18_000,
    queryFn: async () => {
      if (!publicClient || !playToken || !address) throw new Error("no");
      return publicClient.readContract({
        address: playToken,
        abi: playTokenReadAbi,
        functionName: "balanceOf",
        args: [address],
      });
    },
  });

  const userSharesQ = useQuery({
    queryKey: ["play-vault-shares", vaultAddress, address ?? null],
    enabled: !!publicClient && !!address,
    refetchInterval: 18_000,
    queryFn: async () => {
      if (!publicClient || !address) throw new Error("no");
      return publicClient.readContract({
        address: vaultAddress,
        abi: playVaultReadAbi,
        functionName: "sharesOf",
        args: [address],
      });
    },
  });

  const fmt = useCallback(
    (wei: bigint) => {
      try {
        return formatUnits(wei, decimals);
      } catch {
        return wei.toString();
      }
    },
    [decimals],
  );

  const stats = statsQ.data;
  const userShares = userSharesQ.data ?? BigInt(0);
  const userWalletPlay = walletPlayQ.data ?? BigInt(0);

  const lpPosition = useMemo(() => {
    if (!stats) {
      return {
        estPlayLabel: "—",
        sharePctLabel: "—",
        sharesLabel: "—",
      };
    }
    const { totalShares, vaultPlayBal } = stats;
    const sharesLabel = displayPlayAmount(fmt(userShares));
    if (totalShares === BigInt(0)) {
      return {
        estPlayLabel: "0",
        sharePctLabel: "0%",
        sharesLabel,
      };
    }
    const estPlayWei = (userShares * vaultPlayBal) / totalShares;
    const bps = (userShares * BigInt(10000)) / totalShares;
    const sharePctLabel = `${(Number(bps) / 100).toFixed(2)}%`;
    return {
      estPlayLabel: displayPlayAmount(fmt(estPlayWei)),
      sharePctLabel,
      sharesLabel,
    };
  }, [stats, userShares, fmt]);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["play-vault-stats"] });
    await queryClient.invalidateQueries({ queryKey: ["play-vault-shares"] });
    await invalidatePlayBalance(queryClient);
    await queryClient.invalidateQueries({ queryKey: ["wallet-play-balance"] });
  }, [queryClient]);

  const onApprove = useCallback(async () => {
    setErr(null);
    setOk(null);
    if (!address || !walletClient || !publicClient || !playToken) return;
    setBusy(true);
    try {
      const hash = await walletClient.sendTransaction({
        chain: somniaTestnet,
        account: address,
        to: playToken,
        data: encodeFunctionData({
          abi: playTokenWriteAbi,
          functionName: "approve",
          args: [vaultAddress, maxUint256],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setOk("PLAY approved for vault.");
      await invalidate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [address, walletClient, publicClient, playToken, vaultAddress, invalidate]);

  const onDeposit = useCallback(async () => {
    setErr(null);
    setOk(null);
    if (!address || !walletClient || !publicClient || !playToken) return;
    let amount: bigint;
    try {
      amount = parseUnits(depositStr.trim() || "0", decimals);
    } catch {
      setErr("Invalid deposit amount.");
      return;
    }
    if (amount > userWalletPlay) {
      setErr(`Deposit cannot exceed your PLAY balance (${displayPlayAmount(fmt(userWalletPlay))}).`);
      return;
    }
    if (amount === BigInt(0)) {
      setErr("Deposit amount must be > 0.");
      return;
    }
    setBusy(true);
    try {
      const hash = await walletClient.sendTransaction({
        chain: somniaTestnet,
        account: address,
        to: vaultAddress,
        data: encodeFunctionData({
          abi: playVaultWriteAbi,
          functionName: "deposit",
          args: [amount],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setOk("Deposited to vault.");
      await invalidate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [
    address,
    walletClient,
    publicClient,
    playToken,
    vaultAddress,
    depositStr,
    decimals,
    invalidate,
    userWalletPlay,
    fmt,
  ]);

  const onWithdraw = useCallback(async () => {
    setErr(null);
    setOk(null);
    if (!address || !walletClient || !publicClient) return;
    let shares: bigint;
    try {
      shares = parseUnits(withdrawStr.trim() || "0", decimals);
    } catch {
      setErr("Invalid share amount.");
      return;
    }
    if (shares === BigInt(0)) {
      setErr("Share amount must be > 0.");
      return;
    }
    setBusy(true);
    try {
      const hash = await walletClient.sendTransaction({
        chain: somniaTestnet,
        account: address,
        to: vaultAddress,
        data: encodeFunctionData({
          abi: playVaultWriteAbi,
          functionName: "withdraw",
          args: [shares],
        }),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setOk("Withdrew from vault.");
      await invalidate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [address, walletClient, publicClient, vaultAddress, withdrawStr, decimals, invalidate]);

  const fillMaxWithdraw = useCallback(() => {
    setWithdrawStr(formatUnits(userShares, decimals));
  }, [userShares, decimals]);

  const fillMaxDeposit = useCallback(() => {
    setDepositStr(formatUnits(userWalletPlay, decimals));
  }, [userWalletPlay, decimals]);

  const explorer = useMemo(
    () => `https://somnia-testnet.socialscan.io/address/${vaultAddress}`,
    [vaultAddress],
  );

  const playExplorer = useMemo(
    () => (playToken ? `https://somnia-testnet.socialscan.io/address/${playToken}` : ""),
    [playToken],
  );

  const copyVault = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(vaultAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("Could not copy to clipboard.");
    }
  }, [vaultAddress]);

  if (!isAddress(vaultAddress)) {
    return <p className="text-sm text-rose-300">Invalid vault address.</p>;
  }

  return (
    <div className="space-y-8">
      {playQ.isError && (
        <p className="text-sm text-rose-300">Failed to load vault PLAY token: {(playQ.error as Error)?.message}</p>
      )}

      {statsQ.isLoading && <p className="text-sm text-[var(--muted)]">Loading vault…</p>}
      {statsQ.isError && (
        <p className="text-sm text-rose-300">{(statsQ.error as Error)?.message ?? "Failed to load vault"}</p>
      )}

      {stats ? (
        <>
          <section aria-label="Vault totals">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 ring-1 ring-[var(--accent)]/15">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">TVL</p>
                <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-[var(--foreground)]">
                  {displayPlayAmount(fmt(stats.vaultPlayBal))}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">PLAY in the vault contract</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Free float</p>
                <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-[var(--foreground)]">
                  {displayPlayAmount(fmt(stats.freeFloat))}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">Available after liability & floor</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Liability</p>
                <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-[var(--foreground)]">
                  {displayPlayAmount(fmt(stats.totalOutstandingLiability))}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">Reserved for open v2 matches</p>
              </div>
            </div>
          </section>

          <VaultUtilizationPie
            vaultPlayBal={stats.vaultPlayBal}
            totalOutstandingLiability={stats.totalOutstandingLiability}
            freeFloat={stats.freeFloat}
            hardFloorBps={stats.hardFloorBps}
            formatWei={fmt}
            displayAmount={displayPlayAmount}
          />

          <section
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
            aria-label="Your LP position"
          >
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Your LP position</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">Wallet share of the pool (vault shares × pool PLAY).</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Your shares</p>
                <p className="mt-1 font-mono text-lg tabular-nums text-[var(--foreground)]">{lpPosition.sharesLabel}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Est. PLAY value
                </p>
                <p className="mt-1 font-mono text-lg tabular-nums text-[var(--foreground)]">
                  {connected ? lpPosition.estPlayLabel : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Share of pool</p>
                <p className="mt-1 font-mono text-lg tabular-nums text-[var(--foreground)]">
                  {connected ? lpPosition.sharePctLabel : "—"}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => {
                  setErr(null);
                  setOk(null);
                  setLiquidityModalOpen(true);
                }}
                className="inline-flex w-fit items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--surface-highlight-hover)]"
              >
                Manage liquidity
              </button>
              {!connected && <p className="text-sm text-[var(--muted)]">Connect a wallet to add or remove liquidity.</p>}
              {wrongChain && <p className="text-sm text-amber-200/90">Switch network to Somnia testnet.</p>}
            </div>
          </section>

          <VaultManageLiquidityModal
            open={liquidityModalOpen}
            onClose={() => setLiquidityModalOpen(false)}
            mode={liquidityMode}
            onModeChange={setLiquidityMode}
            depositStr={depositStr}
            onDepositStrChange={setDepositStr}
            withdrawStr={withdrawStr}
            onWithdrawStrChange={setWithdrawStr}
            walletPlayFormatted={displayPlayAmount(fmt(userWalletPlay))}
            freeFloatFormatted={stats ? displayPlayAmount(fmt(stats.freeFloat)) : "—"}
            onApprove={onApprove}
            onDeposit={onDeposit}
            onWithdraw={onWithdraw}
            onFillMaxDeposit={fillMaxDeposit}
            onFillMaxWithdraw={fillMaxWithdraw}
            busy={busy}
            connected={connected}
            wrongChain={wrongChain}
            userSharesZero={userShares === BigInt(0)}
            err={err}
            ok={ok}
          />

          <details className="rounded-lg border border-[var(--border)]/80 bg-[var(--surface)]/50 px-4 py-3 text-sm text-[var(--muted)]">
            <summary className="cursor-pointer font-medium text-[var(--foreground)]">Contract & links</summary>
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 font-mono text-[11px] break-all text-[var(--foreground)]">
                  {vaultAddress}
                </p>
                <button
                  type="button"
                  onClick={copyVault}
                  className="shrink-0 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)]"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <a
                  href={explorer}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-[var(--accent)] hover:text-[var(--dream-yellow)]"
                >
                  Vault on explorer
                </a>
                {playToken && playExplorer ? (
                  <a
                    href={playExplorer}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-[var(--accent)] hover:text-[var(--dream-yellow)]"
                  >
                    PLAY on explorer
                  </a>
                ) : null}
              </div>
              {playToken ? (
                <p className="font-mono text-[10px] break-all text-[var(--muted)]">
                  <span className="text-[var(--muted)]">PLAY token:</span> {playToken}
                </p>
              ) : null}
              <dl className="grid gap-2 text-[11px]">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                  <dt className="shrink-0 text-[var(--muted)]">Ledger</dt>
                  <dd className="min-w-0 font-mono break-all text-[var(--foreground)]">{stats.ledger}</dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                  <dt className="shrink-0 text-[var(--muted)]">Positions</dt>
                  <dd className="min-w-0 font-mono break-all text-[var(--foreground)]">{stats.positions}</dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                  <dt className="shrink-0 text-[var(--muted)]">Owner</dt>
                  <dd className="min-w-0 font-mono break-all text-[var(--foreground)]">{stats.owner}</dd>
                </div>
              </dl>
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}
