// @ts-nocheck
import hre from "hardhat";
import { parseEther } from "viem";

import { parseEnvAddress } from "./lib/parse-env-address";

/**
 * Approves PlayscriptCore for 700 PLAY and `lockScript` with soccer picks intended to grade **4/5**
 * against the registered event (wrong match winner, correct exact score and other slots).
 *
 * Fetches the same TheSportsDB URL as registration to read `intHomeScore` / `intAwayScore`.
 *
 * `.env`: `PLAY_TOKEN_ADDRESS`, `PLAYSCRIPT_CORE_ADDRESS`, `PRIVATE_KEY`.
 * `PLAYSCRIPT_MATCH_ID` — which **registered match** to lock (default `0`). This is **not** `scriptId`:
 *   each `lockScript` mints a new script; the first lock on a fresh core is almost always **scriptId 0**.
 * Optional: `PLAYSCRIPT_EVENT_URL` (must match registered match URL for picks to align).
 */
const DEFAULT_URL =
  "https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=133602";

const STAKE_HUMAN = "700";

function envMatchId(): bigint {
  const raw = process.env.PLAYSCRIPT_MATCH_ID?.trim() ?? "0";
  if (!/^\d+$/.test(raw)) throw new Error("PLAYSCRIPT_MATCH_ID must be a non-negative integer.");
  return BigInt(raw);
}

function envStr(name: string, fallback: string): string {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : fallback;
}

/** Soccer `picksPacked`: bits 0–1 winner (0 home 1 draw 2 away), 2 O/U, 3 BTS, 4 CS, 8–15 home goals, 16–23 away. */
function packSoccer(
  w: number,
  ou: 0 | 1,
  s3: 0 | 1,
  s4: 0 | 1,
  ph: number,
  pa: number,
): bigint {
  return (
    BigInt(w) |
    (BigInt(ou) << 2n) |
    (BigInt(s3) << 3n) |
    (BigInt(s4) << 4n) |
    (BigInt(ph) << 8n) |
    (BigInt(pa) << 16n)
  );
}

function actualWinner(h: number, a: number): 0 | 1 | 2 {
  if (h > a) return 0;
  if (a > h) return 2;
  return 1;
}

/** Wrong winner vs reality, everything else matches final score → 4 correct slots. */
function picksPackedSoccerFourOfFive(home: number, away: number): bigint {
  const wTrue = actualWinner(home, away);
  const wWrong: 0 | 1 | 2 = wTrue === 0 ? 2 : wTrue === 2 ? 0 : 0;

  const total = home + away;
  const ou: 0 | 1 = total > 2 ? 1 : 0;
  const bts: 0 | 1 = home > 0 && away > 0 ? 1 : 0;
  const cs: 0 | 1 = home === 0 || away === 0 ? 1 : 0;

  return packSoccer(wWrong, ou, bts, cs, home, away);
}

async function main() {
  const tokenAddr = parseEnvAddress("PLAY_TOKEN_ADDRESS");
  const coreAddr = parseEnvAddress("PLAYSCRIPT_CORE_ADDRESS");
  const matchId = envMatchId();

  const wallets = await hre.viem.getWalletClients();
  if (wallets.length === 0) throw new Error("No wallet (set PRIVATE_KEY).");
  const wallet = wallets[0]!;

  const url = envStr("PLAYSCRIPT_EVENT_URL", DEFAULT_URL);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  const json = (await res.json()) as { results?: { intHomeScore?: string; intAwayScore?: string }[] };
  const eventRow = json.results?.[0];
  if (!eventRow) throw new Error("No results[0] in JSON — check PLAYSCRIPT_EVENT_URL.");

  const home = Number(eventRow.intHomeScore);
  const away = Number(eventRow.intAwayScore);
  if (!Number.isFinite(home) || !Number.isFinite(away) || home < 0 || away < 0 || home > 30 || away > 30) {
    throw new Error(`Bad scores from API: home=${eventRow.intHomeScore} away=${eventRow.intAwayScore}`);
  }

  const picksPacked = picksPackedSoccerFourOfFive(home, away);
  const stake = parseEther(STAKE_HUMAN);

  const publicClient = await hre.viem.getPublicClient();
  const play = await hre.viem.getContractAt("PlayToken", tokenAddr, { client: { wallet } });
  const core = await hre.viem.getContractAt("PlayscriptCore", coreAddr, { client: { wallet } });

  const nextMatchId = await core.read.nextMatchId();
  if (matchId >= nextMatchId) {
    throw new Error(
      `Match ${matchId} is not registered on this core (nextMatchId=${nextMatchId}). ` +
        `Set PLAYSCRIPT_CORE_ADDRESS to the same PlayscriptCore you used when running register.`,
    );
  }

  const m = await core.read.matches_([matchId]);
  const matchRow = m as Record<string, unknown>;
  const kickoffRaw = matchRow.kickoff ?? matchRow[1];
  if (kickoffRaw === undefined || kickoffRaw === null) {
    throw new Error("Could not read match kickoff from matches_(); check contract ABI / viem decode.");
  }
  const kickoff = BigInt(kickoffRaw as bigint | string);
  const latest = await publicClient.getBlock({ blockTag: "latest" });
  if (latest.timestamp >= kickoff) {
    throw new Error("Kickoff passed — lockScript requires block.time < kickoff. Register a new match.");
  }

  console.log("matchId (from PLAYSCRIPT_MATCH_ID):", matchId.toString());
  console.log("API scores (for picks):", home, "–", away);
  console.log("picksPacked:", picksPacked.toString());
  console.log("stake:", STAKE_HUMAN, "PLAY\n");

  console.log("Approving PLAY…");
  const hApprove = await play.write.approve([coreAddr, stake]);
  await publicClient.waitForTransactionReceipt({ hash: hApprove });

  console.log("lockScript…");
  const hLock = await core.write.lockScript([matchId, picksPacked, stake]);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: hLock });

  const scriptId = (await core.read.nextScriptId()) - 1n;
  console.log("Tx:", hLock);
  console.log("scriptId:", scriptId.toString(), "(first lock is usually 0)");
  console.log("Block:", receipt.blockNumber.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
