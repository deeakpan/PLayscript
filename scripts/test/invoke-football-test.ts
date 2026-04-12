import hre from "hardhat";
import { formatUnits } from "viem";

import { DEFAULT_GETLOGS_BLOCK_SPAN } from "../lib/eth-logs-chunked";
import { parseEnvAddress } from "../lib/parse-env-address";

/**
 * `lockScript` only for a match already registered (`register:football-event`). Sends **5×** platform deposit as `msg.value`.
 *
 * **Where “agent details” go:** Somnia’s JSON agent does **not** print into this script. All five requests are
 * created in `lockScript` (same pattern as `invoke-thesportsdb-json-probe` firing multiple txs). Each callback hits
 * `FootballTest.handleFootballFetch` on-chain; the contract `abi.decode`s `responses[0].result` (one uint or string per fetch)
 * into storage. There is **no per-fetch event** with raw JSON. When all five fetches succeed, **`ScriptSettled`** emits the
 * **graded summary**: scores, match status string, slot count, $PLAY payout. Home/away **team names** are stored on-chain
 * on `scripts(scriptId)` but are **not** in that event — after settle we `read.scripts` and print them below.
 *
 * `.env`: `FOOTBALL_TEST_ADDRESS`, `FOOTBALL_MATCH_ID`, `PRIVATE_KEY` (for `--network somnia`).
 * Optional: pick env vars below.
 *
 * Log polling uses chunked `getLogs` (Somnia HTTP RPC caps block span ~1000). For push updates use `listen:football-reactivity`.
 */
const POLL_INTERVAL = 3000;
const TIMEOUT_MS = 600_000;

function parseEnvMatchId(): bigint {
  const raw = process.env.FOOTBALL_MATCH_ID?.trim();
  if (!raw) {
    throw new Error(
      "Set FOOTBALL_MATCH_ID in .env (output of `npm run register:football-event`).",
    );
  }
  try {
    return BigInt(raw);
  } catch {
    throw new Error("FOOTBALL_MATCH_ID must be a decimal integer");
  }
}

function envU8(name: string, fallback: number): number {
  const v = process.env[name]?.trim();
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 255) {
    throw new Error(`${name} must be an integer 0–255`);
  }
  return n;
}

function envBigInt(name: string, fallback: bigint): bigint {
  const v = process.env[name]?.trim();
  if (!v) return fallback;
  try {
    return BigInt(v);
  } catch {
    throw new Error(`${name} must be a decimal integer`);
  }
}

async function main() {
  const addr = parseEnvAddress("FOOTBALL_TEST_ADDRESS");

  const wallets = await hre.viem.getWalletClients();
  if (wallets.length === 0) {
    throw new Error("No wallet (set PRIVATE_KEY for this network).");
  }

  const football = await hre.viem.getContractAt("FootballTest", addr);
  const publicClient = await hre.viem.getPublicClient();

  const depositTotal = await football.read.getRequiredDepositTotal();
  const matchId = parseEnvMatchId();

  console.log("=== FootballTest — lockScript only ===\n");
  console.log("Contract:", addr);
  console.log("matchId:", matchId.toString());
  console.log("Required msg.value (5× deposit):", formatUnits(depositTotal, 18), "native\n");

  const nextMatchId = await football.read.nextMatchId();
  if (matchId >= nextMatchId) {
    throw new Error(
      `FOOTBALL_MATCH_ID=${matchId} is not registered (on-chain nextMatchId=${nextMatchId}). ` +
        `Run register:football-event first, then set FOOTBALL_MATCH_ID to a printed id (< nextMatchId).`,
    );
  }

  const winnerPick = envU8("FOOTBALL_WINNER_PICK", 0);
  const ouPick = envU8("FOOTBALL_OU_PICK", 1);
  const btsPick = envU8("FOOTBALL_BTS_PICK", 1);
  const cleanSheetPick = envU8("FOOTBALL_CLEAN_SHEET_PICK", 0);
  const pickHome = envU8("FOOTBALL_PICK_HOME", 2);
  const pickAway = envU8("FOOTBALL_PICK_AWAY", 1);
  const playAmount = envBigInt("FOOTBALL_PLAY_AMOUNT", 100n);

  if (playAmount < 1n || playAmount > 10_000n) {
    throw new Error("FOOTBALL_PLAY_AMOUNT must be 1–10000");
  }

  console.log("Your picks (sent in lockScript):");
  console.log(
    "  winner:",
    ["Home", "Draw", "Away"][winnerPick],
    "| O/U 2.5:",
    ouPick === 1 ? "Over" : "Under",
    "| BTS:",
    btsPick === 1 ? "Yes" : "No",
    "| clean sheet:",
    cleanSheetPick === 1 ? "Yes" : "No",
    "| exact score:",
    `${pickHome}-${pickAway}`,
    "| playAmount:",
    playAmount.toString(),
  );
  console.log("");

  const scriptId = await football.read.nextScriptId();
  console.log("lockScript (picks + playAmount), expecting scriptId:", scriptId.toString(), "…");
  const lockHash = await football.write.lockScript(
    [
      matchId,
      winnerPick,
      ouPick,
      btsPick,
      cleanSheetPick,
      pickHome,
      pickAway,
      playAmount,
    ],
    { value: depositTotal },
  );
  console.log("Tx:", lockHash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: lockHash });
  const fromBlock = receipt.blockNumber;
  console.log("Confirmed in block", fromBlock.toString());
  console.log("\nWaiting for 5 agent callbacks (up to ~10 min)…\n");

  let nextScanBlock = fromBlock;
  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    const latest = await publicClient.getBlockNumber();
    let lo = nextScanBlock;
    while (lo <= latest) {
      const hi = lo + DEFAULT_GETLOGS_BLOCK_SPAN <= latest ? lo + DEFAULT_GETLOGS_BLOCK_SPAN : latest;

      const settled = await football.getEvents.ScriptSettled({ scriptId }, { fromBlock: lo, toBlock: hi });
      if (settled.length > 0) {
        const ev = settled[settled.length - 1]!;
        const sid = ev.args.scriptId!;
        console.log("\nScriptSettled (agent fetches finished; contract graded vs your picks)");
        console.log("  scriptId:", sid.toString());
        console.log("  correctSlots (of 5):", ev.args.correctSlots?.toString());
        console.log("  payoutPlay ($PLAY units, not transferred):", ev.args.payoutPlay?.toString());
        console.log("  fetched home score:", ev.args.homeScore?.toString());
        console.log("  fetched away score:", ev.args.awayScore?.toString());
        console.log("  fetched status (API):", ev.args.status);

        try {
          const row = await football.read.scripts([sid]);
          const r = row as Record<string, unknown>;
          const homeTeam = r.fetchedHomeTeam ?? r[14];
          const awayTeam = r.fetchedAwayTeam ?? r[15];
          if (typeof homeTeam === "string" && typeof awayTeam === "string") {
            console.log("  fetched home team (API):", homeTeam);
            console.log("  fetched away team (API):", awayTeam);
          }
        } catch {
          console.log("  (could not read scripts() for team names — check contract on explorer)");
        }
        return;
      }

      const failed = await football.getEvents.FootballFetchFailed({ scriptId }, { fromBlock: lo, toBlock: hi });
      if (failed.length > 0) {
        for (const ev of failed) {
          console.log("\nFootballFetchFailed (agent callback: non-success or empty responses)");
          console.log("  scriptId:", ev.args.scriptId?.toString());
          console.log("  field (1=home score … 5=away team):", ev.args.field?.toString());
          console.log("  ResponseStatus (0=Success):", ev.args.status?.toString());
        }
        process.exit(1);
      }

      lo = hi + 1n;
    }
    nextScanBlock = latest + 1n;

    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    process.stdout.write("  polling…\r");
  }

  console.log("\nTimeout — no ScriptSettled. Check explorer / agent.");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
