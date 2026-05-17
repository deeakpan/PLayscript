import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";

describe("PlayscriptV2LockRegistry", () => {
  it("records locks from positions and paginates user history", async () => {
    const [, user] = await hre.viem.getWalletClients();
    const mock = await hre.viem.deployContract("LockRegistryPositionsMock", []);
    const registry = await hre.viem.deployContract("PlayscriptV2LockRegistry", [mock.address]);

    const mask = 0x001f;
    await mock.write.recordLock([
      registry.address,
      user.account.address,
      7n,
      mask,
      parseEther("10"),
      parseEther("9.95"),
      18n,
    ]);

    const count = await registry.read.userLockCount([user.account.address]);
    expect(count).to.equal(1n);

    const page = await registry.read.getUserLocks([user.account.address, 0n, 10n]);
    expect(page[0][0]).to.equal(1n);
    expect(page[1][0]).to.equal(7n);
    expect(page[2][0]).to.equal(mask);
    expect(page[4][0]).to.equal(parseEther("9.95"));

    await mock.write.markClaimed([registry.address, user.account.address, 7n, mask]);
    const page2 = await registry.read.getUserLocks([user.account.address, 0n, 10n]);
    expect(page2[7][0]).to.equal(true);
  });
});
