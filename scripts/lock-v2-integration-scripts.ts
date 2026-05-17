// @ts-nocheck
/**
 * Lock 3 integration scripts on the match from `.v2-integration-match.json`.
 * Writes `lockscripts.json` (used by claim-v2-integration-scripts.ts).
 */
import fs from "node:fs";
import path from "node:path";
import hre from "hardhat";
import { encodeFunctionData, getAddress, isAddress, maxUint256, parseEther } from "viem";

import { getV2DeploymentContract } from "../lib/playscript-v2-deployment-file";
import { playscriptV2PositionsWriteAbi } from "../lib/playscript-v2-positions-abi";
import {
  INTEGRATION_LOCK_PLANS,
  integrationResolvedBitmask,
  planToLegMask12,
} from "../lib/v2-integration-740902";
import { bitmaskToSortedLegIds } from "../lib/playscript-v2-legs";
import { waitWrite } from "./lib/wait-write";

const MATCH_FILE = path.join(process.cwd(), ".v2-integration-match.json");
const LOCK_FILE = path.join(process.cwd(), "lockscripts.json");

const erc20ApproveAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

async function main() {
  if (!fs.existsSync(MATCH_FILE)) {
    throw new Error(`Missing ${MATCH_FILE} — run register-v2-integration-match.ts first.`);
  }
  const matchMeta = JSON.parse(fs.readFileSync(MATCH_FILE, "utf8")) as {
    kernel: string;
    matchId: string;
    home: string;
    away: string;
    expectedResolvedBitmask?: number;
  };

  const wallets = await hre.viem.getWalletClients();
  if (wallets.length === 0) throw new Error("No wallet (set PRIVATE_KEY).");
  const wallet = wallets[0];
  const publicClient = await hre.viem.getPublicClient();

  const positionsAddr =
    getV2DeploymentContract("PlayscriptV2Positions") ??
    (matchMeta as { positions?: string }).positions;
  if (!positionsAddr || !isAddress(positionsAddr)) throw new Error("PlayscriptV2Positions address missing.");

  const playAddr = getV2DeploymentContract("PlayToken") ?? process.env.PLAY_TOKEN_ADDRESS?.trim();
  if (!playAddr || !isAddress(playAddr)) throw new Error("PLAY token address missing.");

  const kernelAddr = getAddress(matchMeta.kernel) as `0x${string}`;
  const matchId = BigInt(matchMeta.matchId);

  const kernel = await hre.viem.getContractAt("PlayscriptKernel", kernelAddr, {
    client: { public: publicClient },
  });
  const m = await kernel.read.matches([matchId]);
  if (Number(m.state) !== 0) {
    throw new Error(`Match ${matchId} state is ${m.state} (need OPEN=0).`);
  }

  const positions = await hre.viem.getContractAt("PlayscriptV2Positions", positionsAddr, {
    client: { wallet, public: publicClient },
  });

  const resolved = integrationResolvedBitmask();
  console.log("Expected resolved bitmask:", resolved, `(0x${resolved.toString(16)})`);

  const resetMasks = (process.env.INTEGRATION_UNWIND_MASKS ?? "31,47,271")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  for (const mask of resetMasks) {
    const tokenId = await positions.read.scriptTokenId([matchId, mask]);
    const bal = await positions.read.balanceOf([wallet.account.address, tokenId]);
    if (bal > 0n) {
      console.log(`Unwinding prior lock mask=${mask} balance=${bal.toString()}`);
      const unwindHash = await wallet.writeContract({
        address: getAddress(positionsAddr) as `0x${string}`,
        abi: playscriptV2PositionsWriteAbi,
        functionName: "unwind",
        args: [matchId, mask, bal],
      });
      await waitWrite(publicClient, unwindHash);
    }
  }

  const approveHash = await wallet.writeContract({
    address: getAddress(playAddr) as `0x${string}`,
    abi: erc20ApproveAbi,
    functionName: "approve",
    args: [getAddress(positionsAddr) as `0x${string}`, maxUint256],
  });
  await waitWrite(publicClient, approveHash);
  console.log("Approved PLAY for positions.");

  const locks = [];

  for (const plan of INTEGRATION_LOCK_PLANS) {
    const legMask12 = planToLegMask12(plan);
    const pop = bitmaskToSortedLegIds(legMask12).length;
    if (pop !== 5) throw new Error(`Invalid mask for ${plan.label}`);

    const subset = (legMask12 & resolved) === legMask12;
    if (plan.expectWin && !subset) {
      throw new Error(`${plan.label} expected to win but mask is not subset of resolved`);
    }
    if (!plan.expectWin && subset) {
      throw new Error(`${plan.label} expected to lose but mask is fully contained in resolved`);
    }

    const playAmount = parseEther(plan.playAmountHuman);
    const room = await kernel.read.lockRoom([matchId]);
    console.log(
      `\nLocking ${plan.label}: mask=${legMask12} legs=${bitmaskToSortedLegIds(legMask12).join(",")} PLAY=${plan.playAmountHuman} room=${room.toString()}`,
    );
    if (room === 0n) throw new Error(`No lock room left before ${plan.label}`);

    const hash = await wallet.writeContract({
      address: getAddress(positionsAddr) as `0x${string}`,
      abi: playscriptV2PositionsWriteAbi,
      functionName: "lockScript",
      args: [matchId, legMask12, playAmount],
    });
    const receipt = await waitWrite(publicClient, hash);

    const tokenId = await positions.read.scriptTokenId([matchId, legMask12]);
    const netBalance = await positions.read.balanceOf([wallet.account.address, tokenId]);

    locks.push({
      label: plan.label,
      expectWin: plan.expectWin,
      matchId: matchId.toString(),
      legMask12,
      legIds: bitmaskToSortedLegIds(legMask12),
      playAmountRequestedHuman: plan.playAmountHuman,
      playAmountRequestedWei: playAmount.toString(),
      lockTx: hash,
      lockBlock: receipt.blockNumber?.toString(),
      scriptTokenId: tokenId.toString(),
      netStakeWei: netBalance.toString(),
      wallet: wallet.account.address,
    });
  }

  const out = {
    schemaVersion: 1,
    network: "somnia",
    kernel: kernelAddr,
    positions: getAddress(positionsAddr),
    playToken: getAddress(playAddr),
    matchId: matchId.toString(),
    home: matchMeta.home,
    away: matchMeta.away,
    expectedResolvedBitmask: resolved,
    expectedFinalScore: "3-0",
    lockedAt: new Date().toISOString(),
    locks,
  };

  fs.writeFileSync(LOCK_FILE, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log("\nWrote", LOCK_FILE);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
