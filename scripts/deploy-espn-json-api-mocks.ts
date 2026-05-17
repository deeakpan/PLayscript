// @ts-nocheck
/**
 * Deploy `EspnJsonApiFetchMocks` on Somnia.
 *
 *   npx hardhat run scripts/deploy-espn-json-api-mocks.ts --network somnia
 *
 * Writes `deployments/espn-mock-somnia.json`.
 * Env: `PRIVATE_KEY`
 */
import fs from "node:fs";
import path from "node:path";

import hre from "hardhat";

const OUT = path.join(process.cwd(), "deployments", "espn-mock-somnia.json");

async function main() {
  const art = await hre.artifacts.readArtifact("EspnJsonApiFetchMocks");
  const wallets = await hre.viem.getWalletClients();
  if (wallets.length === 0) throw new Error("No wallet (set PRIVATE_KEY).");
  const wallet = wallets[0];
  const publicClient = await hre.viem.getPublicClient();

  const hash = await wallet.deployContract({
    abi: art.abi,
    bytecode: art.bytecode as `0x${string}`,
    account: wallet.account,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress;
  if (!address) throw new Error("Deploy receipt missing contractAddress");

  const dep = await publicClient.readContract({
    address,
    abi: art.abi,
    functionName: "getRequiredDeposit",
  });

  const payload = {
    network: hre.network.name,
    chainId: publicClient.chain?.id,
    EspnJsonApiFetchMocks: address,
    deployedAt: new Date().toISOString(),
    deployTx: hash,
    agentDepositWei: dep.toString(),
    probeCallCounts: {
      soccerEpl: 8,
      nba: 6,
      nfl: 6,
      mlb: 2,
    },
    fixtures: {
      soccerEpl: { eventId: "740902", urls: "see contract constants" },
      nba: { eventId: "400878160" },
      nfl: { eventId: "401671764" },
      mlb: { eventId: "401695561" },
    },
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");

  console.log("EspnJsonApiFetchMocks:", address);
  console.log("getRequiredDeposit (wei):", dep.toString());
  console.log("Wrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
