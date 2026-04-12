import hre from "hardhat";

import { parseEnvAddress } from "../lib/parse-env-address";

/**
 * Calls `registerEvent` only (URL + five JSON selectors). Use `invoke:football-test` to `lockScript`.
 *
 * `.env`: `FOOTBALL_TEST_ADDRESS`, `PRIVATE_KEY` (for `--network somnia`).
 * Optional: `FOOTBALL_EVENT_URL`, `FOOTBALL_SEL_HOME_SCORE`, … (defaults match `JsonApiProbe` TheSportsDB demo).
 */
const DEFAULT_URL =
  "https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=133602";

function envStr(name: string, fallback: string): string {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : fallback;
}

async function main() {
  const addr = parseEnvAddress("FOOTBALL_TEST_ADDRESS");

  const wallets = await hre.viem.getWalletClients();
  if (wallets.length === 0) {
    throw new Error("No wallet (set PRIVATE_KEY for this network).");
  }

  const football = await hre.viem.getContractAt("FootballTest", addr);
  const publicClient = await hre.viem.getPublicClient();

  const url = envStr("FOOTBALL_EVENT_URL", DEFAULT_URL);
  const selHomeScore = envStr("FOOTBALL_SEL_HOME_SCORE", "results[0].intHomeScore");
  const selAwayScore = envStr("FOOTBALL_SEL_AWAY_SCORE", "results[0].intAwayScore");
  const selStatus = envStr("FOOTBALL_SEL_STATUS", "results[0].strStatus");
  const selHomeTeam = envStr("FOOTBALL_SEL_HOME_TEAM", "results[0].strHomeTeam");
  const selAwayTeam = envStr("FOOTBALL_SEL_AWAY_TEAM", "results[0].strAwayTeam");

  console.log("=== FootballTest — registerEvent only ===\n");
  console.log("Contract:", addr);
  console.log("URL:", url, "\n");

  const nextBefore = await football.read.nextMatchId();

  const regHash = await football.write.registerEvent([
    url,
    selHomeScore,
    selAwayScore,
    selStatus,
    selHomeTeam,
    selAwayTeam,
  ]);
  console.log("Tx:", regHash);
  await publicClient.waitForTransactionReceipt({ hash: regHash });

  const nextAfter = await football.read.nextMatchId();
  if (nextAfter !== nextBefore + 1n) {
    throw new Error("Unexpected nextMatchId after registerEvent (concurrent registration?)");
  }
  const matchId = nextBefore;

  console.log("\nmatchId:", matchId.toString());
  console.log("\nFor lockScript, set in .env:");
  console.log(`  FOOTBALL_MATCH_ID=${matchId.toString()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
