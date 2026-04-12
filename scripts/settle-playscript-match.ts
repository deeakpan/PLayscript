// @ts-nocheck
import hre from "hardhat";
import { formatEther } from "viem";

import { parseEnvAddress } from "./lib/parse-env-address";

/**
 * Calls `settleMatch(matchId)` with `msg.value` = `getSettleDepositTotal()` (5× platform deposit).
 * Run only after `kickoff + finalizeDelaySec` (see `getFinalizeTimestamp`).
 *
 * `.env`: `PLAYSCRIPT_CORE_ADDRESS`, `PRIVATE_KEY`.
 * `PLAYSCRIPT_MATCH_ID` — default `0`. Optional: pass id after `--`, e.g.
 *   `npx hardhat run scripts/settle-playscript-match.ts --network somnia -- 0`
 */
function parseMatchIdFromArgv(): string | undefined {
  const dash = process.argv.indexOf("--");
  if (dash >= 0) {
    const a = process.argv[dash + 1];
    if (a && /^\d+$/.test(a)) return a;
  }
  return undefined;
}

function matchId(): bigint {
  const raw = (parseMatchIdFromArgv() ?? process.env.PLAYSCRIPT_MATCH_ID?.trim() ?? "0").replace(
    /^["']|["']$/g,
    "",
  );
  if (!/^\d+$/.test(raw)) throw new Error("match id must be a non-negative integer (argv or PLAYSCRIPT_MATCH_ID).");
  return BigInt(raw);
}

async function main() {
  const coreAddr = parseEnvAddress("PLAYSCRIPT_CORE_ADDRESS");
  const id = matchId();

  const wallets = await hre.viem.getWalletClients();
  if (wallets.length === 0) throw new Error("No wallet (set PRIVATE_KEY).");
  const wallet = wallets[0]!;

  const publicClient = await hre.viem.getPublicClient();
  const core = await hre.viem.getContractAt("PlayscriptCore", coreAddr, { client: { wallet } });

  const nextMatchId = await core.read.nextMatchId();
  if (id >= nextMatchId) {
    throw new Error(
      `Match ${id} is not registered on this core (nextMatchId=${nextMatchId}). ` +
        `Sync PLAYSCRIPT_CORE_ADDRESS with the contract used for register.`,
    );
  }

  const m = await core.read.matches_([id]);
  const row = m as Record<string, unknown>;
  const settled =
    typeof row.settled === "boolean" ? row.settled : typeof row[10] === "boolean" ? (row[10] as boolean) : false;
  if (settled) throw new Error(`Match ${id} is already settled.`);

  const finalizeAfter = await core.read.getFinalizeTimestamp([id]);
  const latest = await publicClient.getBlock({ blockTag: "latest" });
  if (latest.timestamp < finalizeAfter) {
    const waitSec = Number(finalizeAfter - latest.timestamp);
    throw new Error(
      `Too early to settle. Chain now=${latest.timestamp}, need >= finalizeAfter=${finalizeAfter} (wait ~${waitSec}s).`,
    );
  }

  const value = await core.read.getSettleDepositTotal();
  console.log("settleMatch matchId:", id.toString());
  console.log("msg.value:    ", value.toString(), "wei (" + formatEther(value) + " native)");
  console.log("Calling settleMatch…");

  const hash = await core.write.settleMatch([id], { value });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Tx:", hash);
  console.log("\nAgent callbacks will complete settlement; then `claimPayout(scriptId)` for each script.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
