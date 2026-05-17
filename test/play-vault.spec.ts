import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";

describe("PlayVault", () => {
  const wad = parseEther("1");

  it("first deposit mints shares 1:1", async () => {
    const [owner, lp] = await hre.viem.getWalletClients();
    const play = await hre.viem.deployContract("PlayToken", [owner.account.address]);
    await play.write.setMinter([owner.account.address]);
    const vault = await hre.viem.deployContract("PlayVault", [play.address, owner.account.address]);

    await play.write.mint([lp.account.address, 1000n * wad]);
    await play.write.approve([vault.address, 500n * wad], { account: lp.account });
    await vault.write.deposit([100n * wad], { account: lp.account });

    const shares = await vault.read.sharesOf([lp.account.address]);
    expect(shares).to.equal(100n * wad);
    const bal = await play.read.balanceOf([vault.address]);
    expect(bal).to.equal(100n * wad);
    expect(await vault.read.totalShares()).to.equal(100n * wad);
  });

  it("second deposit mints shares proportional to pool", async () => {
    const [owner, a, b] = await hre.viem.getWalletClients();
    const play = await hre.viem.deployContract("PlayToken", [owner.account.address]);
    await play.write.setMinter([owner.account.address]);
    const vault = await hre.viem.deployContract("PlayVault", [play.address, owner.account.address]);

    await play.write.mint([a.account.address, 1000n * wad]);
    await play.write.mint([b.account.address, 1000n * wad]);

    await play.write.approve([vault.address, 100n * wad], { account: a.account });
    await vault.write.deposit([100n * wad], { account: a.account });

    await play.write.approve([vault.address, 100n * wad], { account: b.account });
    await vault.write.deposit([50n * wad], { account: b.account });

    const sharesB = await vault.read.sharesOf([b.account.address]);
    expect(sharesB).to.equal(50n * wad);
    expect(await vault.read.totalShares()).to.equal(150n * wad);
  });

  it("addLiability and clearLiability adjust freeFloat", async () => {
    const [owner, lp] = await hre.viem.getWalletClients();
    const play = await hre.viem.deployContract("PlayToken", [owner.account.address]);
    await play.write.setMinter([owner.account.address]);
    const vault = await hre.viem.deployContract("PlayVault", [play.address, owner.account.address]);

    await play.write.mint([lp.account.address, 1000n * wad]);
    await play.write.approve([vault.address, 1000n * wad], { account: lp.account });
    await vault.write.deposit([1000n * wad], { account: lp.account });

    const ff0 = await vault.read.freeFloat();
    expect(ff0 > 0n).to.equal(true);

    await vault.write.addLiability([100n * wad], { account: owner.account });
    expect(await vault.read.totalOutstandingLiability()).to.equal(100n * wad);

    const ff1 = await vault.read.freeFloat();
    expect(ff1).to.equal(ff0 - 100n * wad);

    await vault.write.clearLiability([100n * wad], { account: owner.account });
    expect(await vault.read.totalOutstandingLiability()).to.equal(0n);
    expect(await vault.read.freeFloat()).to.equal(ff0);
  });

  it("withdraw returns PLAY and burns shares", async () => {
    const [owner, lp] = await hre.viem.getWalletClients();
    const play = await hre.viem.deployContract("PlayToken", [owner.account.address]);
    await play.write.setMinter([owner.account.address]);
    const vault = await hre.viem.deployContract("PlayVault", [play.address, owner.account.address]);

    await play.write.mint([lp.account.address, 1000n * wad]);
    await play.write.approve([vault.address, 200n * wad], { account: lp.account });
    await vault.write.deposit([200n * wad], { account: lp.account });

    const before = await play.read.balanceOf([lp.account.address]);
    await vault.write.withdraw([50n * wad], { account: lp.account });
    const after = await play.read.balanceOf([lp.account.address]);
    expect(after - before).to.equal(50n * wad);
    expect(await vault.read.sharesOf([lp.account.address])).to.equal(150n * wad);
  });

  it("pay sends PLAY from vault (ledger)", async () => {
    const [owner, lp, winner] = await hre.viem.getWalletClients();
    const play = await hre.viem.deployContract("PlayToken", [owner.account.address]);
    await play.write.setMinter([owner.account.address]);
    const vault = await hre.viem.deployContract("PlayVault", [play.address, owner.account.address]);

    await play.write.mint([lp.account.address, 500n * wad]);
    await play.write.approve([vault.address, 200n * wad], { account: lp.account });
    await vault.write.deposit([200n * wad], { account: lp.account });

    const wBefore = await play.read.balanceOf([winner.account.address]);
    await vault.write.pay([winner.account.address, 25n * wad], { account: owner.account });
    const wAfter = await play.read.balanceOf([winner.account.address]);
    expect(wAfter - wBefore).to.equal(25n * wad);
  });

  it("releaseStake pulls PLAY when caller is positions", async () => {
    const [owner, lp, positions] = await hre.viem.getWalletClients();
    const play = await hre.viem.deployContract("PlayToken", [owner.account.address]);
    await play.write.setMinter([owner.account.address]);
    const vault = await hre.viem.deployContract("PlayVault", [play.address, owner.account.address]);

    await play.write.mint([lp.account.address, 500n * wad]);
    await play.write.approve([vault.address, 100n * wad], { account: lp.account });
    await vault.write.deposit([100n * wad], { account: lp.account });

    await vault.write.setPositions([positions.account.address], { account: owner.account });

    const recvBefore = await play.read.balanceOf([lp.account.address]);
    await vault.write.releaseStake([lp.account.address, 30n * wad], { account: positions.account });
    const recvAfter = await play.read.balanceOf([lp.account.address]);
    expect(recvAfter - recvBefore).to.equal(30n * wad);
  });
});
