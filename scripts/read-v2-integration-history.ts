// @ts-nocheck
/** Decode lock/claim history from `lockscripts.json` txs on Somnia. */
import fs from "node:fs";
import path from "node:path";
import hre from "hardhat";
import { formatEther } from "viem";

const LOCK_FILE = path.join(process.cwd(), "lockscripts.json");

async function main() {
  const file = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8"));
  const publicClient = await hre.viem.getPublicClient();
  const kernelAbi = (await hre.artifacts.readArtifact("PlayscriptKernel")).abi;
  const posAbi = (await hre.artifacts.readArtifact("PlayscriptV2Positions")).abi;
  const vaultAbi = (await hre.artifacts.readArtifact("PlayVault")).abi;
  const kernel = file.kernel as `0x${string}`;
  const positions = file.positions as `0x${string}`;
  const vault = (await import("../lib/playscript-v2-deployment-file")).getV2DeploymentContract("PlayVault");
  const matchId = BigInt(file.matchId);

  console.log("Match", file.matchId, file.home, "vs", file.away, "\n");

  for (const lock of file.locks) {
    const receipt = await publicClient.getTransactionReceipt({ hash: lock.lockTx as `0x${string}` });
    let row = {
      label: lock.label,
      lockTx: lock.lockTx,
      actualStake: null as string | null,
      netStake: null as string | null,
      rate: null as string | null,
      liability: null as string | null,
    };
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== positions.toLowerCase()) continue;
      try {
        const ev = await publicClient.decodeEventLog({ abi: posAbi, data: log.data, topics: log.topics });
        if (ev.eventName === "ScriptLocked") {
          row = {
            ...row,
            actualStake: formatEther(ev.args.actualStake),
            netStake: formatEther(ev.args.netStake),
            rate: (ev.args.payoutRate ?? ev.args.rate).toString(),
            liability: formatEther(ev.args.liability ?? ev.args.actualLiability),
          };
        }
      } catch {
        /* ignore */
      }
    }
    const mask = lock.legMask12;
    const score = await publicClient.readContract({
      address: kernel,
      abi: kernelAbi,
      functionName: "difficultyScore",
      args: [matchId, mask],
    });
    const payoutRate = await publicClient.readContract({
      address: kernel,
      abi: kernelAbi,
      functionName: "getPayoutRate",
      args: [score],
    });
    console.log(`[LOCK] ${lock.label}`);
    console.log("  requested PLAY:", lock.playAmountRequestedHuman);
    console.log("  actualStake:", row.actualStake ?? "?", "PLAY");
    console.log("  netStake (ERC-1155):", row.netStake ?? formatEther(BigInt(lock.netStakeWei)), "PLAY");
    console.log("  liability reserved:", row.liability ?? "?", "PLAY");
    console.log("  difficultyScore:", score.toString(), "| payoutRate (×10):", payoutRate.toString());
    console.log("  implied max payout if win:", formatEther((BigInt(lock.netStakeWei) * payoutRate) / 10n), "PLAY");
    console.log("");
  }

  const winner = file.locks.find((l) => l.label === "winner-5of5");
  const claim = file.claims?.find((c) => c.label === "winner-5of5" && c.claimTx);
  if (claim?.claimTx) {
    const receipt = await publicClient.getTransactionReceipt({ hash: claim.claimTx as `0x${string}` });
    let payout: string | null = null;
    for (const log of receipt.logs) {
      try {
        if (log.address.toLowerCase() === kernel.toLowerCase()) {
          const ev = await publicClient.decodeEventLog({ abi: kernelAbi, data: log.data, topics: log.topics });
          if (ev.eventName === "ScriptPaid") payout = formatEther(ev.args.payout);
        }
        if (vault && log.address.toLowerCase() === vault.toLowerCase()) {
          const ev = await publicClient.decodeEventLog({ abi: vaultAbi, data: log.data, topics: log.topics });
          if (ev.eventName === "Paid" && ev.args.to.toLowerCase() === file.locks[0].wallet.toLowerCase()) {
            payout = formatEther(ev.args.amount);
          }
        }
      } catch {
        /* ignore */
      }
    }
    console.log("[CLAIM] winner-5of5");
    console.log("  claimTx:", claim.claimTx);
    console.log("  netStake burned:", formatEther(BigInt(claim.amountWei)), "PLAY");
    console.log("  vault payout (ScriptPaid):", payout ?? "?", "PLAY");
    if (payout && winner) {
      const net = Number(formatEther(BigInt(winner.netStakeWei)));
      const out = Number(payout);
      console.log("  profit (payout − netStake):", (out - net).toFixed(6), "PLAY");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
