// @ts-nocheck
/**
 * Owner-only native withdrawals from Playscript v2 host + kernel (`--network somnia`).
 *
 * Defaults: 39 STT from host, 40 from kernel, recipient = signer (or `WITHDRAW_NATIVE_TO`).
 *
 * Env: `PRIVATE_KEY`; optional `WITHDRAW_NATIVE_TO`, `PLAYSCRIPT_V2_WDR_HOST_STT`,
 * `PLAYSCRIPT_V2_WDR_KERNEL_STT`.
 */
import hre from "hardhat";
import { formatEther, getAddress, isAddress, parseEther } from "viem";

import { getV2DeploymentContract } from "../lib/playscript-v2-deployment-file";

async function waitWrite(publicClient, writeResult) {
  const hash =
    typeof writeResult === "string"
      ? writeResult
      : writeResult?.transactionHash ?? writeResult?.hash;
  if (typeof hash !== "string" || !hash.startsWith("0x")) {
    throw new Error(`waitWrite: expected tx hash, got ${String(writeResult)}`);
  }
  const rec = await publicClient.waitForTransactionReceipt({ hash });
  if (rec.status !== "success") throw new Error(`Transaction failed: ${hash}`);
  return rec;
}

async function main() {
  const wallets = await hre.viem.getWalletClients();
  if (wallets.length === 0) throw new Error("No wallet (set PRIVATE_KEY).");
  const wallet = wallets[0];
  const deployer = wallet.account.address;
  const publicClient = await hre.viem.getPublicClient();

  const toRaw = process.env.WITHDRAW_NATIVE_TO?.trim().replace(/^["']|["']$/g, "");
  const to =
    toRaw && isAddress(toRaw)
      ? (getAddress(toRaw) as `0x${string}`)
      : (getAddress(deployer) as `0x${string}`);

  const hostAmount = parseEther(process.env.PLAYSCRIPT_V2_WDR_HOST_STT?.trim() || "39");
  const kernelAmount = parseEther(process.env.PLAYSCRIPT_V2_WDR_KERNEL_STT?.trim() || "39");

  const hostAddr = getV2DeploymentContract("PlayscriptReactivityHost");
  const kernelAddr = getV2DeploymentContract("PlayscriptKernel");
  if (!hostAddr || !kernelAddr) {
    throw new Error("Host or kernel address missing in deployments/playscript-v2-somnia.json.");
  }

  const host = await hre.viem.getContractAt("PlayscriptReactivityHost", hostAddr, {
    client: { wallet, public: publicClient },
  });
  console.log(`PlayscriptReactivityHost ${hostAddr}: withdraw ${formatEther(hostAmount)} to ${to}`);
  const hostTx = await host.write.withdrawNative([to, hostAmount]);
  const hostRec = await waitWrite(publicClient, hostTx);
  console.log("  tx:", hostRec.transactionHash);

  const kernel = await hre.viem.getContractAt("PlayscriptKernel", kernelAddr, {
    client: { wallet, public: publicClient },
  });
  console.log(`PlayscriptKernel ${kernelAddr}: withdraw ${formatEther(kernelAmount)} to ${to}`);
  const kernelTx = await kernel.write.withdrawNative([to, kernelAmount]);
  const kernelRec = await waitWrite(publicClient, kernelTx);
  console.log("  tx:", kernelRec.transactionHash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
