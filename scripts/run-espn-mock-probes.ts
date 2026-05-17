// @ts-nocheck
/**
 * Submit ESPN mock probe bundles on Somnia, poll contract storage, compare to offchain JSON.
 *
 *   npx hardhat run scripts/run-espn-mock-probes.ts --network somnia
 *
 * Env:
 *   PRIVATE_KEY
 *   ESPN_MOCK_ADDRESS — or reads deployments/espn-mock-somnia.json
 *   ESPN_PROBE_SPORTS — comma list: soccer,nba,nfl,mlb (default all)
 *   ESPN_PROBE_POLL_SEC — default 180
 */
import fs from "node:fs";
import path from "node:path";

import hre from "hardhat";
import { formatEther, getContract } from "viem";

const DEPLOY_FILE = path.join(process.cwd(), "deployments", "espn-mock-somnia.json");
const OFFCHAIN = path.join(process.cwd(), "lib", "espn-mock-hardcoded.generated.json");

function loadJson(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function num(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function cmp(label: string, expected: number | null, actual: bigint | null) {
  const a = actual === null ? null : Number(actual);
  const ok = expected !== null && a !== null && expected === a;
  const mark = ok ? "OK" : "MISMATCH";
  console.log(`  ${mark} ${label}: expected=${expected} onchain=${a}`);
  return ok;
}

async function waitWrite(publicClient, hash) {
  const rec = await publicClient.waitForTransactionReceipt({ hash });
  if (rec.status !== "success") throw new Error(`tx failed: ${hash}`);
  return rec;
}

async function pollUntil(fn: () => Promise<boolean>, timeoutSec: number) {
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await sleep(4000);
  }
  return false;
}

async function main() {
  const art = await hre.artifacts.readArtifact("EspnJsonApiFetchMocks");
  const wallets = await hre.viem.getWalletClients();
  if (wallets.length === 0) throw new Error("No wallet (set PRIVATE_KEY).");
  const wallet = wallets[0];
  const publicClient = await hre.viem.getPublicClient();

  const addrEnv = process.env.ESPN_MOCK_ADDRESS?.trim();
  let address = addrEnv;
  if (!address && fs.existsSync(DEPLOY_FILE)) {
    address = loadJson(DEPLOY_FILE).EspnJsonApiFetchMocks;
  }
  if (!address) {
    throw new Error("Set ESPN_MOCK_ADDRESS or deploy first (deploy-espn-json-api-mocks.ts).");
  }

  const c = getContract({
    address: address as `0x${string}`,
    abi: art.abi,
    client: { public: publicClient, wallet },
  });

  const dep = await c.read.getRequiredDeposit();
  const sports = (process.env.ESPN_PROBE_SPORTS ?? "soccer,nba,nfl,mlb")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const pollSec = Number(process.env.ESPN_PROBE_POLL_SEC ?? "180");

  console.log("Contract:", address);
  console.log("Deposit per agent call:", formatEther(dep), "STT");
  console.log("Sports:", sports.join(", "));
  console.log("Offchain baseline:", OFFCHAIN);
  console.log("");

  const off = fs.existsSync(OFFCHAIN) ? loadJson(OFFCHAIN) : null;
  const soccerOff = off?.probes?.soccer_eng1;
  const nbaOff = off?.probes?.nba;
  const nflOff = off?.probes?.nfl;
  const mlbOff = off?.probes?.mlb;

  if (sports.includes("soccer")) {
    const n = await c.read.soccerEplProbeCallCount();
    const total = dep * n;
    console.log(`--- Soccer EPL bundle (${n} calls, ${formatEther(total)} STT) ---`);
    const tx = await c.write.requestSoccerEplProbeBundle({ value: total });
    await waitWrite(publicClient, tx);
    console.log("tx:", tx);

    const ok = await pollUntil(async () => {
      const [h, ht] = await Promise.all([
        c.read.soccerFinalHome(),
        c.read.soccerHtHome(),
      ]);
      return h > 0n && ht >= 0n;
    }, pollSec);

    if (!ok) console.warn("WARN: soccer poll timeout — agents may still be pending");

    const [finalH, finalA, htH, htA, yH, yA, rH, rA] = await Promise.all([
      c.read.soccerFinalHome(),
      c.read.soccerFinalAway(),
      c.read.soccerHtHome(),
      c.read.soccerHtAway(),
      c.read.soccerYellowHome(),
      c.read.soccerYellowAway(),
      c.read.soccerRedHome(),
      c.read.soccerRedAway(),
    ]);

    console.log("On-chain soccer:", {
      finalH: finalH.toString(),
      finalA: finalA.toString(),
      htH: htH.toString(),
      htA: htA.toString(),
      yellowH: yH.toString(),
      yellowA: yA.toString(),
      redH: rH.toString(),
      redA: rA.toString(),
    });

    if (soccerOff) {
      console.log("Vs offchain (soccer_eng1):");
      cmp("final home", num(soccerOff.final?.home), finalH);
      cmp("final away", num(soccerOff.final?.away), finalA);
      cmp("HT home", num(soccerOff.soccerHalvesFromSummaryHeader?.half1Home_display), htH);
      cmp("HT away", num(soccerOff.soccerHalvesFromSummaryHeader?.half1Away_display), htA);
      const homeY = soccerOff.summaryTeamStatistics?.find((t) => t.homeAway === "home");
      const awayY = soccerOff.summaryTeamStatistics?.find((t) => t.homeAway === "away");
      cmp("yellow home", num(homeY?.yellowCards), yH);
      cmp("yellow away", num(awayY?.yellowCards), yA);
      cmp("red home", num(homeY?.redCards), rH);
      cmp("red away", num(awayY?.redCards), rA);
    }
    console.log("");
  }

  if (sports.includes("nba")) {
    const n = await c.read.nbaProbeCallCount();
    const total = dep * n;
    console.log(`--- NBA bundle (${n} calls) ---`);
    const tx = await c.write.requestNbaProbeBundle({ value: total });
    await waitWrite(publicClient, tx);
    console.log("tx:", tx);

    await pollUntil(async () => (await c.read.nbaFinalHome()) > 0n, pollSec);

    const [h, a, hq1, hq2, aq1, aq2] = await Promise.all([
      c.read.nbaFinalHome(),
      c.read.nbaFinalAway(),
      c.read.nbaHomeQ1(),
      c.read.nbaHomeQ2(),
      c.read.nbaAwayQ1(),
      c.read.nbaAwayQ2(),
    ]);
    const halfH = Number(hq1) + Number(hq2);
    const halfA = Number(aq1) + Number(aq2);
    console.log("On-chain NBA:", { finalH: h.toString(), finalA: a.toString(), hq1: hq1.toString(), hq2: hq2.toString(), halfH, halfA });

    if (nbaOff) {
      const hp = nbaOff.scoreboard_period_scores?.home_periods ?? [];
      const ap = nbaOff.scoreboard_period_scores?.away_periods ?? [];
      console.log("Vs offchain:");
      cmp("final home", num(nbaOff.final?.home), h);
      cmp("final away", num(nbaOff.final?.away), a);
      cmp("home Q1", num(hp[0]?.displayValue), hq1);
      cmp("home Q2", num(hp[1]?.displayValue), hq2);
      cmp("away Q1", num(ap[0]?.displayValue), aq1);
      cmp("away Q2", num(ap[1]?.displayValue), aq2);
      cmp("1H home (sum)", nbaOff.scoreboard_period_scores?.halfTotals?.regulationFirstHalf_home ?? null, BigInt(halfH));
    }
    console.log("");
  }

  if (sports.includes("nfl")) {
    const n = await c.read.nflProbeCallCount();
    const total = dep * n;
    console.log(`--- NFL bundle (${n} calls) ---`);
    const tx = await c.write.requestNflProbeBundle({ value: total });
    await waitWrite(publicClient, tx);
    console.log("tx:", tx);

    await pollUntil(async () => (await c.read.nflFinalHome()) > 0n, pollSec);

    const [h, a, hq1, hq2, aq1, aq2] = await Promise.all([
      c.read.nflFinalHome(),
      c.read.nflFinalAway(),
      c.read.nflHomeQ1(),
      c.read.nflHomeQ2(),
      c.read.nflAwayQ1(),
      c.read.nflAwayQ2(),
    ]);
    console.log("On-chain NFL:", { finalH: h.toString(), finalA: a.toString(), hq1: hq1.toString(), hq2: hq2.toString() });

    if (nflOff) {
      const hp = nflOff.scoreboard_period_scores?.home_periods ?? [];
      const ap = nflOff.scoreboard_period_scores?.away_periods ?? [];
      console.log("Vs offchain:");
      cmp("final home", num(nflOff.final?.home), h);
      cmp("final away", num(nflOff.final?.away), a);
      cmp("home Q1", num(hp[0]?.displayValue), hq1);
      cmp("home Q2", num(hp[1]?.displayValue), hq2);
    }
    console.log("");
  }

  if (sports.includes("mlb")) {
    const n = await c.read.mlbProbeCallCount();
    const total = dep * n;
    console.log(`--- MLB bundle (${n} calls) ---`);
    const tx = await c.write.requestMlbProbeBundle({ value: total });
    await waitWrite(publicClient, tx);
    console.log("tx:", tx);

    await pollUntil(async () => (await c.read.mlbFinalHome()) > 0n, pollSec);

    const [h, a] = await Promise.all([c.read.mlbFinalHome(), c.read.mlbFinalAway()]);
    console.log("On-chain MLB:", { finalH: h.toString(), finalA: a.toString() });

    if (mlbOff) {
      console.log("Vs offchain:");
      cmp("final home", num(mlbOff.final?.home), h);
      cmp("final away", num(mlbOff.final?.away), a);
    }
  }

  console.log("\nDone. If MISMATCH, wait longer (agents async) or re-run verify: node scripts/espn-api-offchain-verify.mjs");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
