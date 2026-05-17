// @ts-nocheck
/**
 * Claim winning scripts from `lockscripts.json` after match settlement.
 * Skips locks with `expectWin: false` (reverts on-chain if you try).
 */
import fs from "node:fs";
import path from "node:path";
import hre from "hardhat";
import { getAddress, isAddress } from "viem";

import { playscriptV2PositionsWriteAbi } from "../lib/playscript-v2-positions-abi";
import { waitWrite } from "./lib/wait-write";

const LOCK_FILE = path.join(process.cwd(), "lockscripts.json");

async function main() {
  if (!fs.existsSync(LOCK_FILE)) {
    throw new Error(`Missing ${LOCK_FILE} — run lock-v2-integration-scripts.ts first.`);
  }
  const file = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8")) as {
    positions: string;
    kernel: string;
    matchId: string;
    locks: Array<{
      label: string;
      expectWin: boolean;
      legMask12: number;
      netStakeWei: string;
      scriptTokenId: string;
    }>;
  };

  const wallets = await hre.viem.getWalletClients();
  if (wallets.length === 0) throw new Error("No wallet (set PRIVATE_KEY).");
  const wallet = wallets[0];
  const publicClient = await hre.viem.getPublicClient();

  if (!file.positions || !isAddress(file.positions)) throw new Error("positions address missing in lockscripts.json");
  const positionsAddr = getAddress(file.positions) as `0x${string}`;
  const kernelAddr = getAddress(file.kernel) as `0x${string}`;
  const matchId = BigInt(file.matchId);

  const kernel = await hre.viem.getContractAt("PlayscriptKernel", kernelAddr, {
    client: { public: publicClient },
  });
  const m = await kernel.read.matches([matchId]);
  console.log("Match state:", m.state, "settled:", m.settled, "resolvedLegsBitmask:", m.resolvedLegsBitmask.toString());
  if (!m.settled) {
    throw new Error("Match not settled yet — wait until after kickoff + finalizeDelaySec.");
  }

  const positions = await hre.viem.getContractAt("PlayscriptV2Positions", positionsAddr, {
    client: { wallet, public: publicClient },
  });

  const claims = [];

  for (const lock of file.locks) {
    if (!lock.expectWin) {
      console.log(`Skip ${lock.label} (expected loss).`);
      claims.push({ label: lock.label, skipped: true, reason: "expectWin=false" });
      continue;
    }

    const legMask12 = lock.legMask12;
    const bal = await positions.read.balanceOf([wallet.account.address, BigInt(lock.scriptTokenId)]);
    if (bal === 0n) {
      console.log(`Skip ${lock.label}: zero balance.`);
      claims.push({ label: lock.label, skipped: true, reason: "zero balance" });
      continue;
    }

    const win = await kernel.read.isWinningMask([matchId, legMask12]);
    if (!win) {
      throw new Error(`${lock.label} expectWin but isWinningMask=false`);
    }

    console.log(`Claiming ${lock.label}: burn netStake=${bal.toString()}`);
    const hash = await wallet.writeContract({
      address: positionsAddr,
      abi: playscriptV2PositionsWriteAbi,
      functionName: "claim",
      args: [matchId, legMask12, bal],
    });
    await waitWrite(publicClient, hash);
    claims.push({ label: lock.label, claimTx: hash, amountWei: bal.toString() });
    console.log("  tx:", hash);
  }

  file.claims = claims;
  file.claimedAt = new Date().toISOString();
  fs.writeFileSync(LOCK_FILE, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  console.log("\nUpdated", LOCK_FILE);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
