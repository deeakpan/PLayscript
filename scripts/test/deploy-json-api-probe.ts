import hre from "hardhat";

async function main() {
  const probe = await hre.viem.deployContract("JsonApiProbe");
  console.log("JsonApiProbe:", probe.address);
  const deposit = await probe.read.getRequiredDeposit();
  console.log("getRequiredDeposit (wei):", deposit.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
