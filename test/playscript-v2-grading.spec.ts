import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";

describe("PlayscriptV2Grading + payout", () => {
  it("soccer 3-0 HT 2-0 hits home win, over 2.5, HT over 1.5, home CS on 15-leg board", async () => {
    const harness = await hre.viem.deployContract("PlayscriptV2GradingHarness", []);
    const mask = BigInt(
      await harness.read.resolveSoccerMarket([3n, 0n, 2n, 0n, 0n, 2n]),
    );
    expect(mask & (1n << 0n)).to.equal(1n << 0n); // home win
    expect(mask & (1n << 3n)).to.equal(1n << 3n); // home lead HT
    expect(mask & (1n << 6n)).to.equal(1n << 6n); // over 2.5
    expect(mask & (1n << 8n)).to.equal(1n << 8n); // HT over 1.5
    expect(mask & (1n << 11n)).to.equal(1n << 11n); // home clean sheet
    expect(mask & (1n << 10n)).to.equal(0n); // BTTS miss
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
