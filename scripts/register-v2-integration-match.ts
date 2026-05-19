// @ts-nocheck
/**
 * Register match for lock/claim integration (ESPN 740902, winnable 12-leg market).
 *
 * Defaults: kickoff +240s, finalize +120s after kickoff.
 * Writes `.v2-integration-match.json` (used by lock + claim scripts).
 *
 * Env: `PRIVATE_KEY`, optional `REGISTER_TEST_KICKOFF_OFFSET_SEC` (default `240`),
 * `REGISTER_TEST_FINALIZE_DELAY_SEC` (default `120`), `INTEGRATION_MATCH_ID` (expected `1`).
 */
import fs from "node:fs";
import path from "node:path";
import hre from "hardhat";
import { encodeFunctionData, getAddress, isAddress } from "viem";

import { getV2DeploymentContract } from "../lib/playscript-v2-deployment-file";
import {
  INTEGRATION_740902_LEG_KINDS,
  INTEGRATION_740902_LEG_WEIGHTS,
  integrationResolvedBitmask,
} from "../lib/v2-integration-740902";
import { playscriptKernelWriteAbi } from "../lib/playscript-v2-kernel-abi";
import {
  assertEspnSettlementSelectorsResolvable,
  buildV2EspnRegisterUrls,
  v2KernelSportEnum,
} from "../lib/playscript-v2-register-args";
import {
  ESPN_SCOREBOARD_SELECTORS,
  ESPN_SOCCER_SUMMARY_FINAL_SELECTORS,
  ESPN_SOCCER_SUMMARY_SELECTORS,
} from "../lib/espn-v2-selectors";
import { waitWrite } from "./lib/wait-write";

const OUT_MATCH = path.join(process.cwd(), ".v2-integration-match.json");

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
  if (!kernelAddr) throw new Error("Kernel address missing.");

  const eventId = process.env.REGISTER_TEST_EVENT_ID?.trim() || "740902";
  const leagueSlug = process.env.REGISTER_TEST_LEAGUE?.trim() || "soccer/eng.1";
  const home = process.env.REGISTER_TEST_HOME?.trim() || "Manchester City";
  const away = process.env.REGISTER_TEST_AWAY?.trim() || "Crystal Palace";

  const kickoffOffset = Number(process.env.REGISTER_TEST_KICKOFF_OFFSET_SEC ?? "240");
  const finalizeDelaySec = Number(process.env.REGISTER_TEST_FINALIZE_DELAY_SEC ?? "120");
  if (!Number.isFinite(kickoffOffset) || kickoffOffset < 60) {
    throw new Error("REGISTER_TEST_KICKOFF_OFFSET_SEC must be >= 60");
  }

  const latest = await publicClient.getBlock({ blockTag: "latest" });
  const nowSec = Number(latest.timestamp);
  const kickoff = BigInt(nowSec + Math.floor(kickoffOffset));

  const urls = buildV2EspnRegisterUrls(leagueSlug, eventId, "soccer");
  const skipPreflight = ["1", "true", "yes"].includes(
    (process.env.INTEGRATION_SKIP_ESPN_PREFLIGHT ?? "1").trim().toLowerCase(),
  );
  if (skipPreflight) {
    console.log("Skipping ESPN preflight (INTEGRATION_SKIP_ESPN_PREFLIGHT).");
  } else {
    await assertEspnSettlementSelectorsResolvable(urls, "soccer");
  }

  const kernel = await hre.viem.getContractAt("PlayscriptKernel", kernelAddr, {
    client: { wallet, public: publicClient },
  });

  const nextBefore = await publicClient.readContract({
    address: kernelAddr,
    abi: kernel.abi,
    functionName: "nextMatchId",
  });

  const expectedMatchId = process.env.INTEGRATION_MATCH_ID?.trim();
  if (expectedMatchId && nextBefore.toString() !== expectedMatchId) {
    console.warn(
      `Warning: nextMatchId is ${nextBefore}, expected INTEGRATION_MATCH_ID=${expectedMatchId}. Proceeding anyway.`,
    );
  }

  const resolvedPreview = integrationResolvedBitmask();
  console.log("Integration leg kinds:", [...INTEGRATION_740902_LEG_KINDS].join(","));
  console.log("Expected resolvedLegsBitmask (preview):", resolvedPreview, `(0x${resolvedPreview.toString(16)})`);

  const data = encodeFunctionData({
    abi: playscriptKernelWriteAbi,
    functionName: "registerMatch",
    args: [
      v2KernelSportEnum("soccer"),
      kickoff,
      finalizeDelaySec,
      urls.url,
      urls.scoreboardUrl,
      urls.summaryUrl,
      ESPN_SOCCER_SUMMARY_FINAL_SELECTORS.homeScore,
      ESPN_SOCCER_SUMMARY_FINAL_SELECTORS.awayScore,
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
      [...INTEGRATION_740902_LEG_KINDS],
      [...INTEGRATION_740902_LEG_WEIGHTS],
    ],
  });

  const hash = await wallet.sendTransaction({ to: kernelAddr, data });
  await waitWrite(publicClient, hash);

  const matchId = nextBefore;
  const record = {
    kernel: kernelAddr,
    positions: getV2DeploymentContract("PlayscriptV2Positions"),
    matchId: matchId.toString(),
    eventId,
    leagueSlug,
    home,
    away,
    kickoff: kickoff.toString(),
    finalizeDelaySec,
    kickoffOffsetSec: kickoffOffset,
    registerTx: hash,
    legKinds: [...INTEGRATION_740902_LEG_KINDS],
    expectedResolvedBitmask: resolvedPreview,
    registeredAt: new Date().toISOString(),
    registerer: wallet.account.address,
  };

  fs.writeFileSync(OUT_MATCH, `${JSON.stringify(record, null, 2)}\n`, "utf8");

  console.log("\nRegistered integration matchId:", matchId.toString());
  console.log("kickoff unix:", kickoff.toString(), `(~${kickoffOffset}s)`);
  console.log("finalizeDelaySec:", finalizeDelaySec);
  console.log("Tx:", hash);
  console.log("Wrote", OUT_MATCH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
