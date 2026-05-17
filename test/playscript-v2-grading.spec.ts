import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";

describe("PlayscriptV2Grading + payout", () => {
  it("soccer 3-0 HT 2-0, 2 yellows resolves home win, over 2.5, HT lead, yellow 2+", async () => {
    const harness = await hre.viem.deployContract("PlayscriptV2GradingHarness", []);
    const mask = BigInt(
      await harness.read.resolveSoccer([3n, 0n, 2n, 0n, 0n, 2n]),
    );
    expect(mask & 1n).to.equal(1n);
    expect(mask & 4n).to.equal(4n);
    expect(mask & 32n).to.equal(32n);
    expect(mask & 64n).to.equal(64n);
    expect(mask & 128n).to.equal(128n);
  });

  it("payout rate table matches design doc", async () => {
    const harness = await hre.viem.deployContract("PlayscriptV2GradingHarness", []);
    expect(await harness.read.payoutRate([50n])).to.equal(18n);
    expect(await harness.read.payoutRate([80n])).to.equal(70n);
    expect(await harness.read.payoutRate([125n])).to.equal(200n);
    const payout = await harness.read.payoutAmount([parseEther("100"), 70n]);
    expect(payout).to.equal(parseEther("700"));
  });
});
