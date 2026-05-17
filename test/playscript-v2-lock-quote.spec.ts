import { expect } from "chai";
import { parseEther } from "viem";

import { quoteV2LockScript } from "../lib/playscript-v2-lock-quote";

describe("quoteV2LockScript", () => {
  it("matches on-chain sizing for full fill", () => {
    const play = parseEther("100");
    const rate = 35n;
    const room = parseEther("1000");
    const q = quoteV2LockScript(play, room, rate);
    expect(q.actualStakeWei).to.equal(play);
    expect(q.lockFeeWei).to.equal((play * 50n) / 10_000n);
    expect(q.netStakeWei).to.equal(q.actualStakeWei - q.lockFeeWei);
    expect(q.payoutIfWinWei).to.equal((q.netStakeWei * rate) / 10n);
    expect(q.partialFill).to.equal(false);
  });

  it("partial fill when liability room is tight", () => {
    const play = parseEther("500");
    const rate = 35n;
    const room = parseEther("100");
    const q = quoteV2LockScript(play, room, rate);
    expect(q.partialFill).to.equal(true);
    expect(q.refundWei).to.be.gt(0n);
    expect(q.actualLiabilityWei).to.equal(room);
  });
});
