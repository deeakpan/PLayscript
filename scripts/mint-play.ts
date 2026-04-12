// @ts-nocheck — Hardhat-viem on `hre`; root tsconfig excludes scripts.
import hre from "hardhat";
import { formatEther, getAddress, isAddress, parseEther } from "viem";

import { parseEnvAddress } from "./lib/parse-env-address";

/**
 * Mints PLAY to a recipient. Only the token `owner` can run this: `mint` is
 * `minter`-only, so the script briefly sets `minter` → owner, mints, then
 * restores the previous minter (usually PlayscriptCore).
 *
 * `.env`: `PLAY_TOKEN_ADDRESS` or `NEXT_PUBLIC_PLAY_TOKEN_ADDRESS`, `PRIVATE_KEY` (must be token owner).
 * Optional: `MINT_TO` (defaults to owner wallet), `PLAY_MINT_HUMAN` (default `100000` = 100k PLAY with 18 decimals).
 */
async function main() {
  let tokenAddr: `0x${string}`;
  try {
    tokenAddr = parseEnvAddress("PLAY_TOKEN_ADDRESS");
  } catch {
    tokenAddr = parseEnvAddress("NEXT_PUBLIC_PLAY_TOKEN_ADDRESS");
  }

  const wallets = await hre.viem.getWalletClients();
  if (wallets.length === 0) {
    throw new Error("No wallet (set PRIVATE_KEY for this network).");
  }
  const ownerWallet = wallets[0]!;
  const deployer = ownerWallet.account.address;

  const human = (process.env.PLAY_MINT_HUMAN ?? "100000").trim().replace(/^["']|["']$/g, "");
  if (!/^\d+(\.\d+)?$/.test(human)) {
    throw new Error(`PLAY_MINT_HUMAN must be a non-negative decimal string (got ${JSON.stringify(human)}).`);
  }
  const amount = parseEther(human);

  let recipient = deployer;
  const rawTo = process.env.MINT_TO?.trim().replace(/^["']|["']$/g, "");
  if (rawTo) {
    if (!isAddress(rawTo)) {
      throw new Error("MINT_TO must be a valid 0x address.");
    }
    recipient = getAddress(rawTo);
  }

  const play = await hre.viem.getContractAt("PlayToken", tokenAddr, {
    client: { wallet: ownerWallet },
  });

  const tokenOwner = await play.read.owner();
  if (tokenOwner.toLowerCase() !== deployer.toLowerCase()) {
    throw new Error(
      `PRIVATE_KEY wallet ${deployer} is not PlayToken owner ${tokenOwner}. Use the deployer key.`,
    );
  }

  const previousMinter = await play.read.minter();
  const needTempMinter = previousMinter.toLowerCase() !== deployer.toLowerCase();

  console.log("PlayToken:", tokenAddr);
  console.log("Mint to:  ", recipient);
  console.log("Amount:   ", formatEther(amount), "PLAY\n");

  if (needTempMinter) {
    console.log("Setting minter → owner (temporary)…");
    const h1 = await play.write.setMinter([deployer]);
    await (await hre.viem.getPublicClient()).waitForTransactionReceipt({ hash: h1 });
  }

  console.log("Minting…");
  const h2 = await play.write.mint([recipient, amount]);
  await (await hre.viem.getPublicClient()).waitForTransactionReceipt({ hash: h2 });
  console.log("Tx:", h2);

  if (needTempMinter) {
    console.log("Restoring minter →", previousMinter);
    const h3 = await play.write.setMinter([previousMinter]);
    await (await hre.viem.getPublicClient()).waitForTransactionReceipt({ hash: h3 });
  }

  const bal = await play.read.balanceOf([recipient]);
  console.log("\nRecipient balance:", formatEther(bal), "PLAY");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
