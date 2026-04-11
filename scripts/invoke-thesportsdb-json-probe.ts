import hre from "hardhat";

import { parseEnvAddress } from "./lib/parse-env-address";

/**
 * Fires all 8 TheSportsDB JSON API demo requests on JsonApiProbe, then polls on-chain
 * storage until `demoTheSportsReceivedMask` is full (8 bits) or timeout.
 *
 * Requires:
 *   - `JSON_API_PROBE_ADDRESS` in `.env` (full `0x` + 40 hex)
 *   - `PRIVATE_KEY` for `--network somnia`
 *
 * Redeploy after contract changes: `npm run deploy:json-probe:somnia`
 */
const FULL_MASK = (1n << 8n) - 1n;
const POLL_MS = 2500;
const TIMEOUT_MS = 420_000;

async function main() {
  const addr = parseEnvAddress("JSON_API_PROBE_ADDRESS");

  const publicClient = await hre.viem.getPublicClient();
  const wallets = await hre.viem.getWalletClients();
  if (wallets.length === 0) {
    throw new Error("No wallet (set PRIVATE_KEY for this network).");
  }

  const probe = await hre.viem.getContractAt("JsonApiProbe", addr);

  const deposit = await probe.read.getRequiredDeposit();
  console.log("JsonApiProbe:", addr);
  console.log("Deposit per request (wei):", deposit.toString(), "\n");

  const pay = { value: deposit };

  const txs: `0x${string}`[] = [];

  console.log("Submitting 8 agent requests (TheSportsDB last event)…");
  txs.push(
    await probe.write.requestDemoTheSportsHomeScore(pay),
    await probe.write.requestDemoTheSportsAwayScore(pay),
    await probe.write.requestDemoTheSportsHomeTeam(pay),
    await probe.write.requestDemoTheSportsAwayTeam(pay),
    await probe.write.requestDemoTheSportsStatus(pay),
    await probe.write.requestDemoTheSportsEvent(pay),
    await probe.write.requestDemoTheSportsLeague(pay),
    await probe.write.requestDemoTheSportsDateEvent(pay),
  );

  let fromBlock = 0n;
  for (const hash of txs) {
    const r = await publicClient.waitForTransactionReceipt({ hash });
    if (fromBlock === 0n) fromBlock = r.blockNumber;
  }
  console.log("All txs confirmed from block", fromBlock.toString());
  console.log("\nWaiting for agent callbacks (mask target:", FULL_MASK.toString(), ")…\n");

  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    const mask = await probe.read.demoTheSportsReceivedMask();
    if (mask === FULL_MASK) break;

    const fail = await probe.getEvents.TheSportsDemoRequestFailed({}, { fromBlock });
    if (fail.length > 0) {
      for (const ev of fail) {
        console.log("RequestFailed field", ev.args.field, "status", ev.args.status);
      }
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
    process.stdout.write(`  mask=${mask.toString()} / ${FULL_MASK.toString()}\r`);
  }

  const finalMask = await probe.read.demoTheSportsReceivedMask();
  console.log("\n");

  if (finalMask !== FULL_MASK) {
    console.error("Timeout — not all fields received. Final mask:", finalMask.toString());
    process.exit(1);
  }

  const homeScore = await probe.read.demoTheSportsHomeScore();
  const awayScore = await probe.read.demoTheSportsAwayScore();
  const homeTeam = await probe.read.demoTheSportsHomeTeam();
  const awayTeam = await probe.read.demoTheSportsAwayTeam();
  const status = await probe.read.demoTheSportsStatus();
  const eventName = await probe.read.demoTheSportsEventName();
  const league = await probe.read.demoTheSportsLeague();
  const dateEvent = await probe.read.demoTheSportsDateEvent();

  console.log("TheSportsDB snapshot (results[0]):\n");
  console.log("  intHomeScore (fetchUint, 0 decimals):", homeScore.toString());
  console.log("  intAwayScore (fetchUint, 0 decimals):", awayScore.toString());
  console.log("  strHomeTeam: ", homeTeam);
  console.log("  strAwayTeam:", awayTeam);
  console.log("  strStatus:  ", status);
  console.log("  strEvent:   ", eventName);
  console.log("  strLeague:  ", league);
  console.log("  dateEvent:  ", dateEvent);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
