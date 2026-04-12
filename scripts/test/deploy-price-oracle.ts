import hre from "hardhat";

async function main() {
  console.log("Deploying PriceOracle (somnia-agents-examples / 01-price-oracle port)…\n");

  const oracle = await hre.viem.deployContract("PriceOracle");

  console.log("PriceOracle:", oracle.address);
  const deposit = await oracle.read.getRequiredDeposit();
  console.log("getRequiredDeposit (wei):", deposit.toString());
  console.log("\nSet in .env (copy full line — address must be 0x + 40 hex digits):");
  console.log(`  PRICE_ORACLE_ADDRESS=${oracle.address}`);
  console.log("\nExplorer:");
  console.log(`  https://shannon-explorer.somnia.network/address/${oracle.address}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
