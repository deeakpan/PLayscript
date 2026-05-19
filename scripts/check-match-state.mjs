/**
 * Usage:
 *   node scripts/check-match-state.mjs           → current kernel from deployments JSON
 *   node scripts/check-match-state.mjs 0x…       → explicit kernel address
 *   node scripts/check-match-state.mjs 0x...      → explicit kernel address
 */
import { readFileSync } from "node:fs";
import { createPublicClient, http } from "viem";

const dep = JSON.parse(readFileSync("deployments/playscript-v2-somnia.json", "utf8"));
const kernelArg = process.argv[2]?.trim();
const kernel =
  kernelArg && kernelArg.startsWith("0x")
    ? kernelArg
    : dep.contracts.PlayscriptKernel.address;
const rpc = process.env.SOMNIA_TESTNET_RPC_URL || "https://api.infra.testnet.somnia.network";

const { readKernelMatch } = await import("../lib/playscript-v2-kernel-read.ts");
const { playscriptKernelReadAbi } = await import("../lib/playscript-v2-kernel-abi.ts");

const client = createPublicClient({ transport: http(rpc, { timeout: 60_000 }) });

const STATE = ["OPEN", "LOCKED", "RESOLVING", "SETTLED"];
const SPORT = ["soccer", "basketball", "americanFootball", "mlb"];

function fmt(sec) {
  if (sec <= 0) return "now (past finalize window)";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 24) return `in ${Math.floor(h / 24)}d ${h % 24}h (${sec}s)`;
  if (h > 0) return `in ${h}h ${m}m (${sec}s)`;
  if (m > 0) return `in ${m}m ${s}s`;
  return `in ${s}s`;
}

async function rawFetchMask(matchId) {
  try {
    const row = await client.readContract({
      address: kernel,
      abi: playscriptKernelReadAbi,
      functionName: "matches",
      args: [BigInt(matchId)],
    });
    return Number(row.fetchMask ?? 0);
  } catch {
    return null;
  }
}

async function printMatch(id) {
  const m = await readKernelMatch(client, kernel, BigInt(id));
  const now = Number((await client.getBlock()).timestamp);
  const kickoff = Number(m.kickoff);
  const delay = m.finalizeDelaySec;
  const finalizeAfter = kickoff + delay;
  const untilFinalize = finalizeAfter - now;
  const fetchMask = await rawFetchMask(id);

  console.log(`\n=== Match ${id} (${kernel.slice(0, 10)}…) ===`);
  if (!m.exists) {
    console.log("  not registered");
    return;
  }
  console.log("  schema:", m.schema);
  console.log("  sport:", SPORT[m.sport] ?? m.sport);
  console.log("  state:", STATE[m.state] ?? m.state);
  console.log("  settled:", m.settled, "| settleInProgress:", m.settleInProgress);
  if (fetchMask !== null) console.log("  fetchMask:", fetchMask, `(0x${fetchMask.toString(16)})`);
  console.log("  score FT:", `${m.finalHome}-${m.finalAway}`, "| HT:", `${m.htHome}-${m.htAway}`);
  console.log("  kickoff:", new Date(kickoff * 1000).toISOString());
  console.log("  finalize delay:", delay, "s (~" + Math.round(delay / 60) + " min)");
  console.log("  settlement eligible after:", new Date(finalizeAfter * 1000).toISOString());
  console.log("  chain now:", new Date(now * 1000).toISOString());

  if (m.settled) {
    console.log("  → SETTLED | resolved bitmask:", m.resolvedLegsBitmask);
  } else if (untilFinalize > 0) {
    console.log("  → Wait for settlement:", fmt(untilFinalize));
  } else if (m.state === 0) {
    console.log("  → Past finalize time but still OPEN (scheduler may not have locked kickoff yet)");
  } else if (m.settleInProgress) {
    console.log("  → SETTLING NOW (agent fetches in flight or retrying)");
  } else if (m.state === 1) {
    console.log("  → Ready to settle (LOCKED, past finalize) — needs startSettle / scheduler");
  } else if (m.state === 2) {
    console.log("  → RESOLVING state — check fetchMask / agent failures");
  }

  const url = m.url || "";
  const ev = url.match(/(\d{5,})/);
  console.log("  url:", url.length > 85 ? url.slice(0, 85) + "…" : url);
  if (ev) console.log("  espn event:", ev[1]);
}

const next = await client.readContract({
  address: kernel,
  abi: playscriptKernelReadAbi,
  functionName: "nextMatchId",
});

console.log("Kernel:", kernel);
console.log("RPC:", rpc);
console.log("nextMatchId:", next.toString());

for (const id of [0, 1]) {
  if (BigInt(id) >= next) {
    console.log(`\n=== Match ${id} ===\n  not on this kernel (nextMatchId=${next})`);
    continue;
  }
  await printMatch(id);
}
