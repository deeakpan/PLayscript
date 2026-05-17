// @ts-nocheck
/**
 * Playscript v2 full stack deploy for Somnia (`npm run deploy:playscript-v2:somnia`).
 *
 * **PlayscriptKernel (ESPN v2)** — aligned with `contracts/demos/EspnJsonApiFetchMocks.sol`:
 * - `registerMatch`: `url`, `scoreboardUrl`, `summaryUrl`, ESPN JSON selectors, `legKinds[12]`, `legWeights[12]`
 * - Settlement: `fetchUint` per field — soccer **8** calls, NBA/NFL **6**, MLB **2** (see `getSettleDepositTotal(sport)`)
 *
 * Steps:
 * 1. Deploy `PlayscriptKernel` (owner = deployer).
 * 2. Fund kernel native (default **50** SOMI — covers many 8×0.12 SOMI soccer settlements).
 * 3. PLAY: `PLAY_TOKEN_ADDRESS` or deploy `PlayToken` + mint to deployer.
 * 4. `PlayVault` + link kernel ↔ vault.
 * 5. `PlayscriptReactivityHost` (constructor native seed, default **40** SOMI).
 * 6. `kernel.setScheduler(host)`; `PlayscriptV2Positions`; link positions.
 * 7. Write `deployments/playscript-v2-somnia.json` (schema v2 + `kernelSettlement` metadata).
 *
 * Env:
 * - `PRIVATE_KEY` (required)
 * - `PLAY_TOKEN_ADDRESS`, `PLAYSCRIPT_V2_DEPLOY_MINT` (default `50000`)
 * - `PLAYSCRIPT_V2_HOST_FUND` — native seed on host constructor (default `40`)
 * - `PLAYSCRIPT_V2_KERNEL_FUND` — native sent to kernel after deploy (default `50`)
 * - `PLAYSCRIPT_V2_DEPLOYMENT_OUT` — output JSON path
 */
import fs from "node:fs";
import path from "node:path";
import hre from "hardhat";
import { formatEther, getAddress, isAddress, parseEther } from "viem";

/** Sport enum order in `PlayscriptKernel.Sport`. */
const KERNEL_SPORT = {
  soccer: 0,
  basketball: 1,
  americanFootball: 2,
  mlb: 3,
} as const;

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
  if (receipt.status !== "success") {
    throw new Error(`Deployment failed: ${contractName} tx ${hash}`);
  }
  if (!receipt.contractAddress) {
    throw new Error(`Deployment missing contractAddress: ${contractName} tx ${hash}`);
  }

  const contract = await hre.viem.getContractAt(contractName, receipt.contractAddress, {
    client: { wallet, public: publicClient },
  });
  return { contract, blockNumber: receipt.blockNumber };
}

async function readSettleDepositTotals(kernel) {
  const [soccer, basketball, nfl, mlb] = await Promise.all([
    kernel.read.getSettleDepositTotal([KERNEL_SPORT.soccer]),
    kernel.read.getSettleDepositTotal([KERNEL_SPORT.basketball]),
    kernel.read.getSettleDepositTotal([KERNEL_SPORT.americanFootball]),
    kernel.read.getSettleDepositTotal([KERNEL_SPORT.mlb]),
  ]);
  return { soccer, basketball, nfl, mlb };
}

async function main() {
  const wallets = await hre.viem.getWalletClients();
  if (wallets.length === 0) throw new Error("No wallet (set PRIVATE_KEY).");
  const wallet = wallets[0];
  const deployer = wallet.account.address;
  const publicClient = await hre.viem.getPublicClient();
  const chainId = Number(await publicClient.getChainId());

  const hostFundHuman = process.env.PLAYSCRIPT_V2_HOST_FUND?.trim() || "40";
  const kernelFundHuman =
    process.env.PLAYSCRIPT_V2_KERNEL_FUND?.trim() ||
    process.env.PLAYSCRIPT_V2_HOST_FUND?.trim() ||
    "50";
  const hostNativeSeed = parseEther(hostFundHuman);
  const kernelNativeFund = parseEther(kernelFundHuman);

  console.log("Deploying PlayscriptKernel (ESPN v2 — fetchUint settlement)…");
  const { contract: kernel, blockNumber: kernelBlock } = await deployAndWait(wallet, "PlayscriptKernel", [deployer], {});

  const settleTotals = await readSettleDepositTotals(kernel);
  const fetchCounts = {
    soccer: 8,
    basketball: 6,
    americanFootball: 6,
    mlb: 2,
  };

  console.log("\nKernel settlement deposit per match (wei / human):");
  console.log(
    "  soccer:   ",
    settleTotals.soccer.toString(),
    `(${formatEther(settleTotals.soccer)} native)`,
  );
  console.log(
    "  NBA:      ",
    settleTotals.basketball.toString(),
    `(${formatEther(settleTotals.basketball)} native)`,
  );
  console.log(
    "  NFL:      ",
    settleTotals.nfl.toString(),
    `(${formatEther(settleTotals.nfl)} native)`,
  );
  console.log(
    "  MLB:      ",
    settleTotals.mlb.toString(),
    `(${formatEther(settleTotals.mlb)} native)`,
  );

  const soccerSettlesAffordable = kernelNativeFund / settleTotals.soccer;
  console.log(
    `\nKernel fund ${kernelFundHuman} SOMI ≈ ${soccerSettlesAffordable.toString()} full soccer settlements (8 agent calls each).`,
  );

  console.log("\nFunding kernel with", kernelFundHuman, "native…");
  const kernelFundHash = await wallet.sendTransaction({
    to: kernel.address,
    value: kernelNativeFund,
  });
  const kernelFundReceipt = await publicClient.waitForTransactionReceipt({ hash: kernelFundHash });
  if (kernelFundReceipt.status !== "success") throw new Error("Kernel funding tx failed");

  const rawPlay = process.env.PLAY_TOKEN_ADDRESS?.trim().replace(/^["']|["']$/g, "");
  let playAddr: `0x${string}`;
  let playTokenDeploymentBlock: bigint | null = null;

  if (rawPlay && isAddress(rawPlay)) {
    playAddr = getAddress(rawPlay) as `0x${string}`;
    console.log("Using PLAY_TOKEN_ADDRESS:", playAddr);
  } else {
    console.log("PLAY_TOKEN_ADDRESS unset — deploying PlayToken…");
    const { contract: play, blockNumber: playBlock } = await deployAndWait(wallet, "PlayToken", [deployer], {});
    playAddr = play.address;
    playTokenDeploymentBlock = playBlock;

    console.log("Setting PlayToken minter → deployer, then minting initial supply…");
    await waitWrite(publicClient, await play.write.setMinter([deployer]));
    const minterAddr = await play.read.minter();
    if (minterAddr.toLowerCase() !== deployer.toLowerCase()) {
      throw new Error(`PlayToken setMinter failed: on-chain minter is ${minterAddr}, expected ${deployer}`);
    }

    const mintHuman = process.env.PLAYSCRIPT_V2_DEPLOY_MINT?.trim() || "50000";
    const mintWei = parseEther(mintHuman);
    await waitWrite(publicClient, await play.write.mint([deployer, mintWei]));
    console.log("Minted", mintHuman, "PLAY to", deployer);
  }

  console.log("Deploying PlayVault…");
  const { contract: vault, blockNumber: vaultBlock } = await deployAndWait(wallet, "PlayVault", [playAddr, deployer], {});

  console.log("Linking kernel ↔ vault…");
  await waitWrite(publicClient, await kernel.write.setVault([vault.address]));
  await waitWrite(publicClient, await vault.write.setLedger([kernel.address]));

  console.log("Deploying PlayscriptReactivityHost with", hostFundHuman, "native…");
  const { contract: host, blockNumber: hostBlock } = await deployAndWait(
    wallet,
    "PlayscriptReactivityHost",
    [kernel.address],
    { value: hostNativeSeed },
  );

  console.log("Linking kernel.setScheduler(host)…");
  await waitWrite(publicClient, await kernel.write.setScheduler([host.address]));

  console.log("Deploying PlayscriptV2Positions…");
  const { contract: positions, blockNumber: positionsBlock } = await deployAndWait(wallet, "PlayscriptV2Positions", [
    kernel.address,
    playAddr,
    vault.address,
  ]);

  console.log("Deploying PlayscriptV2LockRegistry…");
  const { contract: lockRegistry, blockNumber: lockRegistryBlock } = await deployAndWait(
    wallet,
    "PlayscriptV2LockRegistry",
    [positions.address],
    {},
  );

  console.log("Linking positions.setLockRegistry…");
  await waitWrite(publicClient, await positions.write.setLockRegistry([lockRegistry.address]));

  console.log("Linking vault.setPositions + kernel.setPositions…");
  await waitWrite(publicClient, await vault.write.setPositions([positions.address]));
  await waitWrite(publicClient, await kernel.write.setPositions([positions.address]));

  const outRel =
    process.env.PLAYSCRIPT_V2_DEPLOYMENT_OUT?.trim() || path.join("deployments", "playscript-v2-somnia.json");
  const outAbs = path.isAbsolute(outRel) ? outRel : path.join(process.cwd(), outRel);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });

  const deployedAt = new Date().toISOString();
  /** @type {Record<string, { address: string; deploymentBlock: string }>} */
  const contracts = {
    PlayscriptKernel: {
      address: kernel.address,
      deploymentBlock: kernelBlock.toString(),
    },
    PlayVault: {
      address: vault.address,
      deploymentBlock: vaultBlock.toString(),
    },
    PlayscriptReactivityHost: {
      address: host.address,
      deploymentBlock: hostBlock.toString(),
    },
    PlayscriptV2Positions: {
      address: positions.address,
      deploymentBlock: positionsBlock.toString(),
    },
    PlayscriptV2LockRegistry: {
      address: lockRegistry.address,
      deploymentBlock: lockRegistryBlock.toString(),
    },
  };

  if (playTokenDeploymentBlock !== null) {
    contracts.PlayToken = {
      address: playAddr,
      deploymentBlock: playTokenDeploymentBlock.toString(),
    };
  }

  const record = {
    schemaVersion: 2,
    network: "somnia",
    graphNetwork: "somnia-testnet",
    chainId,
    deployedAt,
    deployer,
    playToken: playAddr,
    nativeHostDeployWei: hostNativeSeed.toString(),
    nativeKernelFundWei: kernelNativeFund.toString(),
    kernelFundTxBlock: kernelFundReceipt.blockNumber.toString(),
    kernelSettlement: {
      abi: "espn-v2",
      fetchCounts,
    },
    contracts,
  };

  fs.writeFileSync(outAbs, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  console.log("\nWrote deployment record:", outAbs);

  console.log("\n=== Playscript V2 (ESPN kernel) ===\n");
  console.log("PlayVault:              ", vault.address);
  console.log("PlayscriptKernel:       ", kernel.address);
  console.log("PlayscriptReactivityHost:", host.address);
  console.log("PlayscriptV2Positions:  ", positions.address);
  console.log("PlayscriptV2LockRegistry:", lockRegistry.address);
  console.log("PLAY:                   ", playAddr);
  console.log("Owner:                  ", deployer);

  console.log("\nRegister matches from the app (ESPN URLs + selectors) or:");
  console.log("  npm run register:v2-test-match:somnia");

  console.log("\nCopy into .env:");
  console.log(`  NEXT_PUBLIC_PLAYSCRIPT_V2_KERNEL_ADDRESS=${kernel.address}`);
  console.log(`  NEXT_PUBLIC_PLAYSCRIPT_V2_VAULT_ADDRESS=${vault.address}`);
  console.log(`  PLAYSCRIPT_V2_REACTIVITY_HOST_ADDRESS=${host.address}`);
  console.log(`  NEXT_PUBLIC_PLAYSCRIPT_V2_POSITIONS_ADDRESS=${positions.address}`);
  console.log(`  NEXT_PUBLIC_PLAYSCRIPT_V2_LOCK_REGISTRY_ADDRESS=${lockRegistry.address}`);
  console.log(`  NEXT_PUBLIC_PLAY_TOKEN_ADDRESS=${playAddr}`);
  console.log(`  PLAY_TOKEN_ADDRESS=${playAddr}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
