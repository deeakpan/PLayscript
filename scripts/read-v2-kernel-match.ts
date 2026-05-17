// @ts-nocheck
/**
 * Read `PlayscriptKernel.matches(matchId)` on Somnia (`--network somnia`).
 *
 * Match id + kernel: `READ_MATCH_ID` + `NEXT_PUBLIC_PLAYSCRIPT_V2_KERNEL_ADDRESS`, or
 * `.v2-test-match.tmp.json` written by `register-v2-test-match.ts`.
 */
import fs from "node:fs";
import path from "node:path";
import hre from "hardhat";
import { getAddress, isAddress } from "viem";

import { getV2DeploymentContract } from "../lib/playscript-v2-deployment-file";

const STATE = ["OPEN", "LOCKED", "RESOLVING", "SETTLED"];

async function main() {
  const publicClient = await hre.viem.getPublicClient();

  const envKernel = process.env.NEXT_PUBLIC_PLAYSCRIPT_V2_KERNEL_ADDRESS?.trim().replace(/^["']|["']$/g, "");
  const kernelAddr =
    envKernel && isAddress(envKernel)
      ? (getAddress(envKernel) as `0x${string}`)
      : getV2DeploymentContract("PlayscriptKernel");
  if (!kernelAddr) throw new Error("Kernel address missing.");

  let matchIdArg = process.env.READ_MATCH_ID?.trim();
  if (!matchIdArg) {
    const tmp = path.join(process.cwd(), ".v2-test-match.tmp.json");
    if (fs.existsSync(tmp)) {
      const j = JSON.parse(fs.readFileSync(tmp, "utf8")) as { matchId?: string };
      matchIdArg = j.matchId?.trim();
    }
  }
  if (!matchIdArg) throw new Error("Set READ_MATCH_ID or run register-v2-test-match.ts first (writes .v2-test-match.tmp.json).");

  const matchId = BigInt(matchIdArg);
  const kernel = await hre.viem.getContractAt("PlayscriptKernel", kernelAddr, { client: { public: publicClient } });

  const m = await kernel.read.matches([matchId]);
  const ts = Number(await publicClient.getBlock({ blockTag: "latest" }).then((b) => b.timestamp));

  console.log("Kernel:", kernelAddr);
  console.log("matchId:", matchId.toString());
  console.log("chain now (unix):", ts);
  console.log("kickoff (unix):", m.kickoff.toString(), "| finalizeDelaySec:", m.finalizeDelaySec.toString());
  console.log("state:", m.state, `(${STATE[Number(m.state)] ?? "?"})`);
  console.log("settled:", m.settled, "| settleInProgress:", m.settleInProgress, "| fetchMask:", m.fetchMask.toString());
  console.log("finalHome / finalAway:", m.finalHome.toString(), "/", m.finalAway.toString());
  console.log("resolvedLegsBitmask:", m.resolvedLegsBitmask.toString(), `(0x${Number(m.resolvedLegsBitmask).toString(16)})`);
  console.log("matchLiability / cap:", m.matchLiability.toString(), "/", m.matchLiabilityCap.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
