// @ts-nocheck
/** Native balances for current v2 deploy — `npx hardhat run scripts/check-v2-balances.ts --network somnia` */
import { readFileSync } from "node:fs";
import hre from "hardhat";
import { formatEther } from "viem";

const deployment = JSON.parse(
  readFileSync("deployments/playscript-v2-somnia.json", "utf8"),
);

async function main() {
  const client = await hre.viem.getPublicClient();
  const kernel = deployment.contracts.PlayscriptKernel.address as `0x${string}`;
  const host = deployment.contracts.PlayscriptReactivityHost.address as `0x${string}`;
  const vault = deployment.contracts.PlayVault.address as `0x${string}`;

  const [kBal, hBal, vBal] = await Promise.all([
    client.getBalance({ address: kernel }),
    client.getBalance({ address: host }),
    client.getBalance({ address: vault }),
  ]);

  const kFund = BigInt(deployment.nativeKernelFundWei ?? "0");
  const hFund = BigInt(deployment.nativeHostDeployWei ?? "0");

  console.log("Current v2 deploy (deployments/playscript-v2-somnia.json)\n");
  console.log("Kernel", kernel);
  console.log("  on-chain:", formatEther(kBal), "SOMI");
  console.log(
    "  funded at deploy:",
    formatEther(kFund),
    "SOMI",
    deployment.kernelFundTxBlock ? `(block ${deployment.kernelFundTxBlock})` : "",
  );
  console.log("Host", host);
  console.log("  on-chain:", formatEther(hBal), "SOMI");
  console.log("  constructor seed:", formatEther(hFund), "SOMI");
  console.log("Vault", vault);
  console.log("  on-chain:", formatEther(vBal), "SOMI");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
