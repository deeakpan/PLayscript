// @ts-nocheck
/**
 * Deploy PlayscriptV2LockRegistry + new PlayscriptV2Positions (with registry hook),
 * link registry, and point kernel + vault at the new positions contract.
 *
 * Existing locks on the old positions ERC-1155 remain on the old contract; new locks
 * are indexed in the registry.
 *
 *   npm run deploy:link-v2-lock-registry:somnia
 */
import fs from "node:fs";
import path from "node:path";
import hre from "hardhat";
import { getAddress, isAddress } from "viem";

const deploymentPath = path.join(process.cwd(), "deployments", "playscript-v2-somnia.json");
const deploymentFile = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

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

async function deployAndWait(wallet, contractName, constructorArgs, config) {
  const publicClient = await hre.viem.getPublicClient();
  const artifact = await hre.artifacts.readArtifact(contractName);
  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: constructorArgs,
    ...(config?.value !== undefined ? { value: config.value } : {}),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Deployment failed: ${contractName}`);
  if (!receipt.contractAddress) throw new Error(`Missing contractAddress: ${contractName}`);
  const contract = await hre.viem.getContractAt(contractName, receipt.contractAddress, {
    client: { wallet, public: publicClient },
  });
  return { contract, blockNumber: receipt.blockNumber };
}

async function main() {
  const wallets = await hre.viem.getWalletClients();
  if (wallets.length === 0) throw new Error("No wallet (set PRIVATE_KEY).");
  const wallet = wallets[0];
  const publicClient = await hre.viem.getPublicClient();

  const kernelAddr = getAddress(deploymentFile.contracts.PlayscriptKernel?.address ?? "");
  const vaultAddr = getAddress(deploymentFile.contracts.PlayVault?.address ?? "");
  const playAddr = getAddress(deploymentFile.playToken ?? "");
  const oldPositionsAddr = deploymentFile.contracts.PlayscriptV2Positions?.address;

  if (!kernelAddr || !vaultAddr || !playAddr) {
    throw new Error("deployments/playscript-v2-somnia.json missing kernel, vault, or playToken");
  }

  const kernel = await hre.viem.getContractAt("PlayscriptKernel", kernelAddr, {
    client: { wallet, public: publicClient },
  });
  const vault = await hre.viem.getContractAt("PlayVault", vaultAddr, {
    client: { wallet, public: publicClient },
  });
  const owner = await kernel.read.owner();
  if (owner.toLowerCase() !== wallet.account.address.toLowerCase()) {
    throw new Error(`Deployer ${wallet.account.address} is not kernel owner ${owner}`);
  }

  console.log("Deploying PlayscriptV2Positions (registry hook)…");
  const { contract: positions, blockNumber: positionsBlock } = await deployAndWait(
    wallet,
    "PlayscriptV2Positions",
    [kernelAddr, playAddr, vaultAddr],
    {},
  );

  console.log("Deploying PlayscriptV2LockRegistry…");
  const { contract: registry, blockNumber: registryBlock } = await deployAndWait(
    wallet,
    "PlayscriptV2LockRegistry",
    [positions.address],
    {},
  );

  console.log("Linking positions.setLockRegistry…");
  await waitWrite(publicClient, await positions.write.setLockRegistry([registry.address]));

  console.log("Linking kernel.setPositions + vault.setPositions…");
  await waitWrite(publicClient, await kernel.write.setPositions([positions.address]));
  await waitWrite(publicClient, await vault.write.setPositions([positions.address]));

  const outRel =
    process.env.PLAYSCRIPT_V2_DEPLOYMENT_OUT?.trim() || path.join("deployments", "playscript-v2-somnia.json");
  const outAbs = path.isAbsolute(outRel) ? outRel : path.join(process.cwd(), outRel);

  const record = {
    ...deploymentFile,
    deployedAt: new Date().toISOString(),
    contracts: {
      ...deploymentFile.contracts,
      PlayscriptV2Positions: {
        address: positions.address,
        deploymentBlock: positionsBlock.toString(),
      },
      PlayscriptV2LockRegistry: {
        address: registry.address,
        deploymentBlock: registryBlock.toString(),
      },
    },
    previousPlayscriptV2Positions: oldPositionsAddr ?? null,
  };

  fs.writeFileSync(outAbs, `${JSON.stringify(record, null, 2)}\n`, "utf8");

  console.log("\n=== Lock registry linked ===\n");
  console.log("PlayscriptV2LockRegistry:", registry.address);
  console.log("PlayscriptV2Positions:     ", positions.address);
  if (oldPositionsAddr) console.log("Previous positions:      ", oldPositionsAddr);
  console.log("\nWrote:", outAbs);
  console.log("\nCopy into .env:");
  console.log(`  NEXT_PUBLIC_PLAYSCRIPT_V2_POSITIONS_ADDRESS=${positions.address}`);
  console.log(`  NEXT_PUBLIC_PLAYSCRIPT_V2_LOCK_REGISTRY_ADDRESS=${registry.address}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
