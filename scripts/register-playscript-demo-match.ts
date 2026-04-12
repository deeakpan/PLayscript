// @ts-nocheck — Hardhat-viem on `hre`; root tsconfig excludes scripts.
import hre from "hardhat";

import { parseEnvAddress } from "./lib/parse-env-address";

/**
 * Owner: registers one match on PlayscriptCore using chain time:
 *   kickoff = latest block timestamp + 5 minutes
 *   finalizeDelaySec = 5 minutes (settlement may start 10 min after "now" on chain)
 *
 * Uses the same default TheSportsDB event as `register-playscript-match.ts`.
 *
 * `.env`: `PLAYSCRIPT_CORE_ADDRESS`, `PRIVATE_KEY` (must be core owner).
 * Optional: `PLAYSCRIPT_EVENT_URL`, selector env vars (see `register-playscript-match.ts`).
 */
const DEFAULT_URL =
  "https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=133602";

const KICKOFF_AFTER_SEC = 300;
const FINALIZE_DELAY_SEC = 300;

function envStr(name: string, fallback: string): string {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : fallback;
}

async function main() {
  const coreAddr = parseEnvAddress("PLAYSCRIPT_CORE_ADDRESS");
  const wallets = await hre.viem.getWalletClients();
  if (wallets.length === 0) throw new Error("No wallet (set PRIVATE_KEY).");
  const wallet = wallets[0]!;

  const publicClient = await hre.viem.getPublicClient();
  const head = await publicClient.getBlock({ blockTag: "latest" });
  const now = Number(head.timestamp);
  const kickoff = BigInt(now + KICKOFF_AFTER_SEC);
  const finalizeDelay = FINALIZE_DELAY_SEC;

  const sport = 0; // Soccer — matches URL / selectors
  const url = envStr("PLAYSCRIPT_EVENT_URL", DEFAULT_URL);
  const selHomeScore = envStr("PLAYSCRIPT_SEL_HOME_SCORE", "results[0].intHomeScore");
  const selAwayScore = envStr("PLAYSCRIPT_SEL_AWAY_SCORE", "results[0].intAwayScore");
  const selStatus = envStr("PLAYSCRIPT_SEL_STATUS", "results[0].strStatus");
  const selHomeTeam = envStr("PLAYSCRIPT_SEL_HOME_TEAM", "results[0].strHomeTeam");
  const selAwayTeam = envStr("PLAYSCRIPT_SEL_AWAY_TEAM", "results[0].strAwayTeam");

  const core = await hre.viem.getContractAt("PlayscriptCore", coreAddr, {
    client: { wallet },
  });

  const owner = await core.read.owner();
  if (owner.toLowerCase() !== wallet.account.address.toLowerCase()) {
    throw new Error(`PRIVATE_KEY must be core owner (owner=${owner}).`);
  }

  const before = await core.read.nextMatchId();
  const hash = await core.write.registerMatch([
    sport,
    kickoff,
    finalizeDelay,
    url,
    selHomeScore,
    selAwayScore,
    selStatus,
    selHomeTeam,
    selAwayTeam,
  ]);
  await publicClient.waitForTransactionReceipt({ hash });
  const after = await core.read.nextMatchId();
  if (after !== before + 1n) throw new Error("Unexpected nextMatchId");
  const matchId = before;

  const finalizeAfter = await core.read.getFinalizeTimestamp([matchId]);

  console.log("Chain time (latest block):", now);
  console.log("kickoff unix:             ", kickoff.toString(), `(+${KICKOFF_AFTER_SEC}s)`);
  console.log("finalizeDelaySec:         ", finalizeDelay);
  console.log("settle allowed after:     ", finalizeAfter.toString());
  console.log("\nRegistered matchId:", matchId.toString());
  console.log("Set PLAYSCRIPT_MATCH_ID=" + matchId.toString());
  console.log("\nNext: mint PLAY if needed, run lock script (before kickoff), wait until settle time, run settle script.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
