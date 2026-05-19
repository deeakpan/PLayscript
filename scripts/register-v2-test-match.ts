// @ts-nocheck
import fs from "node:fs";
import path from "node:path";

/**
 * Register a Playscript v2 kernel match for integration testing (`--network somnia`).
 *
 * Uses ESPN scoreboard + summary URLs and selectors from `lib/espn-v2-selectors.ts`,
 * same leg pool / kinds as the fixture UI (`selectV2MarketLegs`).
 *
 * Env:
 * - `PRIVATE_KEY` (required)
 * - Kernel: `NEXT_PUBLIC_PLAYSCRIPT_V2_KERNEL_ADDRESS` or `deployments/playscript-v2-somnia.json`
 * - Optional: `REGISTER_TEST_EVENT_ID` (ESPN event id, default `740902`)
 * - Optional: `REGISTER_TEST_LEAGUE` (ESPN slug, default `soccer/eng.1`)
 * - Optional: `REGISTER_TEST_HOME`, `REGISTER_TEST_AWAY`
 * - Optional: `REGISTER_TEST_SPORT`
 * - Optional: `REGISTER_TEST_KICKOFF_OFFSET_SEC` (default `120`), `REGISTER_TEST_FINALIZE_DELAY_SEC` (default `120`)
 */
import hre from "hardhat";
import { encodeFunctionData, getAddress, isAddress } from "viem";

import type { ScriptSportKey } from "../lib/fixtures-shared";
import { isScriptSportKey } from "../lib/fixtures-shared";
import { getV2DeploymentContract } from "../lib/playscript-v2-deployment-file";
import { playscriptKernelWriteAbi } from "../lib/playscript-v2-kernel-abi";
import {
  assertEspnSettlementSelectorsResolvable,
  buildV2EspnRegisterUrls,
  v2DefaultLegKinds,
  v2DefaultLegWeights,
  v2KernelSportEnum,
  v2MarketLegsForFixture,
} from "../lib/playscript-v2-register-args";
import {
  ESPN_SCOREBOARD_SELECTORS,
  ESPN_SOCCER_SUMMARY_FINAL_SELECTORS,
  ESPN_SOCCER_SUMMARY_SELECTORS,
} from "../lib/espn-v2-selectors";

async function waitWrite(publicClient, writeResult) {
  const hash =
    typeof writeResult === "string"
      ? writeResult
      : writeResult?.transactionHash ?? writeResult?.hash;
  if (typeof hash !== "string" || !hash.startsWith("0x")) {
    throw new Error(`waitWrite: expected tx hash, got ${String(writeResult)}`);
  }
  const rec = await publicClient.waitForTransactionReceipt({ hash });
  if (rec.status !== "success") throw new Error(`Transaction failed: ${hash}`);
  return rec;
}

async function main() {
  const wallets = await hre.viem.getWalletClients();
  if (wallets.length === 0) throw new Error("No wallet (set PRIVATE_KEY).");
  const wallet = wallets[0];
  const publicClient = await hre.viem.getPublicClient();

  const envKernel = process.env.NEXT_PUBLIC_PLAYSCRIPT_V2_KERNEL_ADDRESS?.trim().replace(/^["']|["']$/g, "");
  const kernelAddr =
    envKernel && isAddress(envKernel)
      ? (getAddress(envKernel) as `0x${string}`)
      : getV2DeploymentContract("PlayscriptKernel");
  if (!kernelAddr) {
    throw new Error(
      "Kernel address missing: set NEXT_PUBLIC_PLAYSCRIPT_V2_KERNEL_ADDRESS or commit PlayscriptKernel in deployments/playscript-v2-somnia.json.",
    );
  }

  const eventId = process.env.REGISTER_TEST_EVENT_ID?.trim() || "740902";
  const leagueSlug = process.env.REGISTER_TEST_LEAGUE?.trim() || "soccer/eng.1";
  const home = process.env.REGISTER_TEST_HOME?.trim() || "Manchester City";
  const away = process.env.REGISTER_TEST_AWAY?.trim() || "Crystal Palace";
  const sportRaw = process.env.REGISTER_TEST_SPORT?.trim() || "soccer";
  if (!isScriptSportKey(sportRaw)) {
    throw new Error(`REGISTER_TEST_SPORT must be one of: soccer, basketball, american_football, baseball`);
  }
  const sportKey = sportRaw as ScriptSportKey;

  const kickoffOffset = Number(process.env.REGISTER_TEST_KICKOFF_OFFSET_SEC ?? "120");
  const finalizeDelaySec = Number(process.env.REGISTER_TEST_FINALIZE_DELAY_SEC ?? "120");
  if (!Number.isFinite(kickoffOffset) || kickoffOffset < 60) {
    throw new Error("REGISTER_TEST_KICKOFF_OFFSET_SEC must be a number >= 60 (on-chain BadKickoff margin).");
  }
  if (!Number.isFinite(finalizeDelaySec) || finalizeDelaySec < 1 || finalizeDelaySec > 86_400 * 7) {
    throw new Error("REGISTER_TEST_FINALIZE_DELAY_SEC invalid.");
  }

  const latest = await publicClient.getBlock({ blockTag: "latest" });
  const nowSec = Number(latest.timestamp);
  const kickoff = BigInt(nowSec + Math.floor(kickoffOffset));

  const urls = buildV2EspnRegisterUrls(leagueSlug, eventId, sportKey);
  const legs = v2MarketLegsForFixture(eventId, home, away, sportKey);
  const legKinds = v2DefaultLegKinds(legs);
  const legWeights = v2DefaultLegWeights(legs);
  const sport = v2KernelSportEnum(sportKey);

  console.log("Preflight ESPN settlement selectors (finished-game probe)…");
  await assertEspnSettlementSelectorsResolvable(urls, sportKey);
  console.log("Settlement selectors OK (scoreboard + summary/quarters as needed).");

  const kernel = await hre.viem.getContractAt("PlayscriptKernel", kernelAddr, {
    client: { wallet, public: publicClient },
  });

  const nextBefore = await publicClient.readContract({
    address: kernelAddr,
    abi: kernel.abi,
    functionName: "nextMatchId",
  });

  console.log("Kernel:", kernelAddr);
  console.log("url:", urls.url);
  console.log("scoreboardUrl:", urls.scoreboardUrl);
  console.log("summaryUrl:", urls.summaryUrl);
  console.log("Teams:", home, "vs", away, "| sport:", sportKey);
  console.log("Leg kinds:", [...legKinds].join(","));
  console.log("Leg weights:", [...legWeights].join(","));
  console.log("kickoff (unix):", kickoff.toString(), `(~${kickoffOffset}s from latest block time ${nowSec})`);
  console.log("finalizeDelaySec:", finalizeDelaySec);

  const ftScoreSel =
    sportKey === "soccer" ? ESPN_SOCCER_SUMMARY_FINAL_SELECTORS : ESPN_SCOREBOARD_SELECTORS;

  const data = encodeFunctionData({
    abi: playscriptKernelWriteAbi,
    functionName: "registerMatch",
    args: [
      sport,
      kickoff,
      finalizeDelaySec,
      urls.url,
      urls.scoreboardUrl,
      urls.summaryUrl,
      ftScoreSel.homeScore,
      ftScoreSel.awayScore,
      ESPN_SOCCER_SUMMARY_SELECTORS.htHome,
      ESPN_SOCCER_SUMMARY_SELECTORS.htAway,
      ESPN_SOCCER_SUMMARY_SELECTORS.yellowHome,
      ESPN_SOCCER_SUMMARY_SELECTORS.yellowAway,
      ESPN_SOCCER_SUMMARY_SELECTORS.redHome,
      ESPN_SOCCER_SUMMARY_SELECTORS.redAway,
      ESPN_SCOREBOARD_SELECTORS.homeQ1,
      ESPN_SCOREBOARD_SELECTORS.homeQ2,
      ESPN_SCOREBOARD_SELECTORS.awayQ1,
      ESPN_SCOREBOARD_SELECTORS.awayQ2,
      [...legKinds],
      [...legWeights],
    ],
  });

  const hash = await wallet.sendTransaction({
    to: kernelAddr,
    data,
  });
  await waitWrite(publicClient, hash);

  const nextAfter = await publicClient.readContract({
    address: kernelAddr,
    abi: kernel.abi,
    functionName: "nextMatchId",
  });

  const matchId = nextBefore;
  console.log("\nRegistered matchId:", matchId.toString());
  console.log("nextMatchId after:", nextAfter.toString());
  console.log("Tx:", hash);

  const tmp = path.join(process.cwd(), ".v2-test-match.tmp.json");
  fs.writeFileSync(
    tmp,
    JSON.stringify({ kernel: kernelAddr, matchId: matchId.toString(), tx: hash }, null, 2),
    "utf8",
  );
  console.log("\nWrote", tmp, "for read-v2-kernel-match.ts");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
