// @ts-nocheck
/** Scan kernel settlement events for match 0 and print failure pattern. */
import fs from "node:fs";

import hre from "hardhat";
import { getAddress, isAddress, parseAbiItem } from "viem";

import { getV2DeploymentContract } from "../lib/playscript-v2-deployment-file";

const STATUS = ["None", "Pending", "Success", "Failed", "TimedOut"];

async function main() {
  const envKernel = process.env.NEXT_PUBLIC_PLAYSCRIPT_V2_KERNEL_ADDRESS?.trim();
  const kernelAddr =
    envKernel && isAddress(envKernel)
      ? getAddress(envKernel)
      : getV2DeploymentContract("PlayscriptKernel");

  const matchId = BigInt(process.env.READ_MATCH_ID?.trim() || "0");
  const publicClient = await hre.viem.getPublicClient();
  const kernel = await hre.viem.getContractAt("PlayscriptKernel", kernelAddr, {
    client: { public: publicClient },
  });

  const deployBlock = BigInt(
    JSON.parse(fs.readFileSync("deployments/playscript-v2-somnia.json", "utf8")).contracts
      .PlayscriptKernel.deploymentBlock,
  );

  const m = await kernel.read.matches([matchId]);
  const dep = await publicClient.readContract({
    address: kernelAddr,
    abi: kernel.abi,
    functionName: "getSettleDepositTotal",
    args: [m.sport],
  });

  console.log("Kernel:", kernelAddr);
  console.log("Match:", matchId.toString());
  console.log("sport:", m.sport, "| state:", m.state, "| settled:", m.settled);
  console.log("settleInProgress:", m.settleInProgress, "| fetchMask:", m.fetchMask.toString(), `(0b${Number(m.fetchMask).toString(2)})`);
  console.log("scores on-chain FT:", m.finalHome.toString(), m.finalAway.toString(), "HT:", m.htHome.toString(), m.htAway.toString());
  console.log("cards Y/R:", m.yellowHome.toString(), m.yellowAway.toString(), m.redHome.toString(), m.redAway.toString());
  console.log("scoreboardUrl:", m.scoreboardUrl);
  console.log("summaryUrl:", m.summaryUrl);
  console.log("kernel native balance:", (await publicClient.getBalance({ address: kernelAddr })).toString());
  console.log("settle deposit total (8 fields):", dep.toString());

  const latest = await publicClient.getBlockNumber();
  const events = [
    parseAbiItem("event ResolutionStarted(uint256 indexed matchId, uint256 timestamp)"),
    parseAbiItem(
      "event MatchSettleFetchFailed(uint256 indexed matchId, uint8 field, uint8 status)",
    ),
    parseAbiItem(
      "event SettleRetryScheduled(uint256 indexed matchId, uint32 newFinalizeDelaySec, uint64 retryAt, uint8 field, uint8 status)",
    ),
    parseAbiItem(
      "event MatchSettled(uint256 indexed matchId, uint256 finalHome, uint256 finalAway, uint16 resolvedLegsBitmask)",
    ),
  ] as const;

  const logs: Awaited<ReturnType<typeof publicClient.getLogs>> = [];
  const chunk = 999n;
  for (let from = deployBlock; from <= latest; from += chunk) {
    const to = from + chunk - 1n > latest ? latest : from + chunk - 1n;
    const part = await publicClient.getLogs({
      address: kernelAddr,
      fromBlock: from,
      toBlock: to,
      events: [...events],
    });
    logs.push(...part);
  }

  const forMatch = logs.filter((l) => {
    const mid = l.args?.matchId;
    return mid !== undefined && BigInt(mid) === matchId;
  });

  console.log(`\nEvents for match ${matchId} since deploy (${forMatch.length} total):`);

  const counts = { started: 0, failed: {} as Record<number, Record<string, number>>, retries: 0, settled: 0 };
  for (const l of forMatch.sort((a, b) => Number(a.blockNumber - b.blockNumber))) {
    const name = l.eventName;
    if (name === "ResolutionStarted") {
      counts.started++;
      console.log(`  [${l.blockNumber}] ResolutionStarted`);
    } else if (name === "MatchSettleFetchFailed") {
      const field = Number(l.args.field);
      const st = STATUS[Number(l.args.status)] ?? String(l.args.status);
      counts.failed[field] = counts.failed[field] ?? {};
      counts.failed[field][st] = (counts.failed[field][st] ?? 0) + 1;
      console.log(`  [${l.blockNumber}] MatchSettleFetchFailed field=${field} status=${st}`);
    } else if (name === "SettleRetryScheduled") {
      counts.retries++;
      const field = Number(l.args.field);
      const st = STATUS[Number(l.args.status)] ?? String(l.args.status);
      console.log(
        `  [${l.blockNumber}] SettleRetryScheduled field=${field} status=${st} retryAt=${l.args.retryAt}`,
      );
    } else if (name === "MatchSettled") {
      counts.settled++;
      console.log(`  [${l.blockNumber}] MatchSettled bitmask=${l.args.resolvedLegsBitmask}`);
    }
  }

  console.log("\nSummary:");
  console.log("  ResolutionStarted:", counts.started);
  console.log("  SettleRetryScheduled:", counts.retries);
  console.log("  MatchSettled:", counts.settled);
  console.log("  Failures by field:", JSON.stringify(counts.failed));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
