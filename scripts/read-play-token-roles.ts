// @ts-nocheck
import hre from "hardhat";

const PLAY = "0xEFA95569C06B8D77fC80092cf5BAa7f766728b83" as const;

async function main() {
  const play = await hre.viem.getContractAt("PlayToken", PLAY);
  const [minter, owner, totalSupply] = await Promise.all([
    play.read.minter(),
    play.read.owner(),
    play.read.totalSupply(),
  ]);
  console.log("PLAY:", PLAY);
  console.log("owner:", owner);
  console.log("minter:", minter);
  console.log("totalSupply:", totalSupply.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
