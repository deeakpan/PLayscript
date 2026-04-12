// @ts-nocheck — Hardhat-viem on `hre` needs artifact-augmented types; root `tsconfig.json` excludes `scripts`.
import hre from "hardhat";
import { getAddress, isAddress } from "viem";

/**
 * Deploys `PlayToken` + `PlayscriptCore`, wires `minter` to core, prints env hints.
 *
 * `.env` (optional on Somnia): `PLAYSCRIPT_TREASURY` — defaults to deployer wallet if unset.
 */
async function main() {
  const wallets = await hre.viem.getWalletClients();
  if (wallets.length === 0) {
    throw new Error("No wallet (set PRIVATE_KEY for this network).");
  }
  const deployer = wallets[0]!.account.address;

  let treasury = deployer;
  const rawTreasury = process.env.PLAYSCRIPT_TREASURY?.trim().replace(/^["']|["']$/g, "");
  if (rawTreasury) {
    if (!isAddress(rawTreasury)) {
      throw new Error("PLAYSCRIPT_TREASURY must be a valid 0x address.");
    }
    treasury = getAddress(rawTreasury);
  }

  console.log("Deploying PlayToken…");
  const play = await hre.viem.deployContract("PlayToken", [deployer]);

  console.log("Deploying PlayscriptCore…");
  const core = await hre.viem.deployContract("PlayscriptCore", [play.address, treasury, deployer]);

  console.log("Setting PlayToken minter → PlayscriptCore…");
  await play.write.setMinter([core.address]);

  console.log("\n=== Playscript ===\n");
  console.log("PlayToken:     ", play.address);
  console.log("PlayscriptCore:", core.address);
  console.log("Owner:        ", deployer);
  console.log("Treasury:     ", treasury);
  try {
    const dep = await core.read.getSettleDepositTotal();
    console.log("settleMatch msg.value (5× deposit wei):", dep.toString());
  } catch {
    console.log(
      "settleMatch msg.value: (could not read — Somnia platform not at 0x037B… on this chain; use getSettleDepositTotal on Somnia testnet.)"
    );
  }

  console.log("\nSet in .env:");
  console.log(`  PLAY_TOKEN_ADDRESS=${play.address}`);
  console.log(`  PLAYSCRIPT_CORE_ADDRESS=${core.address}`);
  console.log("\nExplorer (core):");
  console.log(`  https://shannon-explorer.somnia.network/address/${core.address}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
