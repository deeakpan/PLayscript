import hre from "hardhat";

async function main() {
  console.log("Deploying FootballTest (5-slot JSON fetch + grade, no ERC20)…\n");

  const football = await hre.viem.deployContract("FootballTest");

  console.log("FootballTest:", football.address);
  const depositTotal = await football.read.getRequiredDepositTotal();
  console.log("getRequiredDepositTotal (wei, 5× platform):", depositTotal.toString());
  console.log("\nSet in .env:");
  console.log(`  FOOTBALL_TEST_ADDRESS=${football.address}`);
  console.log("\nExplorer:");
  console.log(`  https://shannon-explorer.somnia.network/address/${football.address}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
