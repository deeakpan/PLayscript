import hre from "hardhat";

import { parseEnvAddress } from "./lib/parse-env-address";

/**
 * Owner-only `registerMatch` on `PlayscriptCore`.
 *
 * `.env`: `PLAYSCRIPT_CORE_ADDRESS`, `PRIVATE_KEY`, plus:
 *   PLAYSCRIPT_SPORT — 0=Soccer 1=Basketball 2=NFL 3=MLB
 *   PLAYSCRIPT_KICKOFF_UNIX — seconds since epoch (UTC)
 *   PLAYSCRIPT_FINALIZE_DELAY — optional seconds after kickoff before settle (default 7200 if unset/0)
 *   PLAYSCRIPT_EVENT_URL — TheSportsDB URL
 *   PLAYSCRIPT_SEL_HOME_SCORE … _AWAY_TEAM — five selectors (same as FootballTest / JsonApiProbe)
 */
const DEFAULT_URL =
  "https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=133602";

function envU8(name: string, fallback: number): number {
  const v = process.env[name]?.trim();
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 255) throw new Error(`${name} must be 0–255`);
  return n;
}

function envU32(name: string, fallback: number): number {
  const v = process.env[name]?.trim();
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 4_294_967_295) throw new Error(`${name} invalid`);
  return n;
}

function envStr(name: string, fallback: string): string {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : fallback;
}

async function main() {
  const coreAddr = parseEnvAddress("PLAYSCRIPT_CORE_ADDRESS");
  const wallets = await hre.viem.getWalletClients();
  if (wallets.length === 0) throw new Error("No wallet (set PRIVATE_KEY).");

  const core = await hre.viem.getContractAt("PlayscriptCore", coreAddr);
  const publicClient = await hre.viem.getPublicClient();

  const sport = envU8("PLAYSCRIPT_SPORT", 0);
  const kickoff = BigInt(envU32("PLAYSCRIPT_KICKOFF_UNIX", Math.floor(Date.now() / 1000) + 86_400));
  const finalizeDelay = envU32("PLAYSCRIPT_FINALIZE_DELAY", 0);
  const url = envStr("PLAYSCRIPT_EVENT_URL", DEFAULT_URL);
  const selHomeScore = envStr("PLAYSCRIPT_SEL_HOME_SCORE", "results[0].intHomeScore");
  const selAwayScore = envStr("PLAYSCRIPT_SEL_AWAY_SCORE", "results[0].intAwayScore");
  const selStatus = envStr("PLAYSCRIPT_SEL_STATUS", "results[0].strStatus");
  const selHomeTeam = envStr("PLAYSCRIPT_SEL_HOME_TEAM", "results[0].strHomeTeam");
  const selAwayTeam = envStr("PLAYSCRIPT_SEL_AWAY_TEAM", "results[0].strAwayTeam");

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

  console.log("Registered matchId:", matchId.toString());
  console.log("Use this match id when locking: PLAYSCRIPT_MATCH_ID=" + matchId.toString());
  console.log("finalizeAfter ≈ kickoff + delay — read getFinalizeTimestamp(matchId) on-chain.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
