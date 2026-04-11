import hre from "hardhat";
import { formatUnits } from "viem";

import { parseEnvAddress } from "./lib/parse-env-address";

/**
 * Invokes `requestBtcPrice` on deployed PriceOracle and polls for `PriceReceived`.
 *
 * `.env`: `PRICE_ORACLE_ADDRESS` (full `0x` + 40 hex — no truncation), `PRIVATE_KEY` (for `--network somnia`)
 */
const POLL_INTERVAL = 2000;
const TIMEOUT_MS = 420_000;

async function main() {
  const addr = parseEnvAddress("PRICE_ORACLE_ADDRESS");

  const wallets = await hre.viem.getWalletClients();
  if (wallets.length === 0) {
    throw new Error("No wallet (set PRIVATE_KEY for this network).");
  }

  const oracle = await hre.viem.getContractAt("PriceOracle", addr);
  const publicClient = await hre.viem.getPublicClient();

  const deposit = await oracle.read.getRequiredDeposit();
  console.log("=== PriceOracle — BTC via Somnia JSON API agent ===\n");
  console.log("Oracle:", addr);
  console.log("Required deposit:", formatUnits(deposit, 18), "native\n");

  console.log("Calling requestBtcPrice…");
  const hash = await oracle.write.requestBtcPrice({ value: deposit });
  console.log("Tx:", hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const fromBlock = receipt.blockNumber;
  console.log("Confirmed in block", fromBlock.toString());
  console.log("\nWaiting for agent callback (up to ~7 min)…\n");

  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    const ok = await oracle.getEvents.PriceReceived({}, { fromBlock });
    if (ok.length > 0) {
      for (const ev of ok) {
        const price = ev.args.price!;
        const wholePart = price / BigInt(1e8);
        const decimalPart = price % BigInt(1e8);
        console.log("PriceReceived");
        console.log("  BTC/USD:", `$${wholePart}.${decimalPart.toString().padStart(8, "0")}`);
        console.log("  raw (8 decimals):", price.toString());
      }
      return;
    }

    const bad = await oracle.getEvents.RequestFailed({}, { fromBlock });
    if (bad.length > 0) {
      for (const ev of bad) {
        console.log("RequestFailed status:", ev.args.status?.toString());
      }
      process.exit(1);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    process.stdout.write("  polling…\r");
  }

  console.log("\nTimeout — no PriceReceived. Check explorer / Somnia agent status.");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
