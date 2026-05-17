/** Mirrors `PlayscriptV2Positions.lockScript` sizing (fee + partial fill). */

export const V2_LOCK_FEE_BPS = 50;

export type V2LockQuote = {
  playAmountWei: bigint;
  payoutRate: bigint;
  liabilityRoomWei: bigint;
  requestedLiabilityWei: bigint;
  actualLiabilityWei: bigint;
  actualStakeWei: bigint;
  lockFeeWei: bigint;
  netStakeWei: bigint;
  payoutIfWinWei: bigint;
  refundWei: bigint;
  partialFill: boolean;
  noRoom: boolean;
};

/** Same steps as on-chain `lockScript` before token transfers. */
export function quoteV2LockScript(
  playAmountWei: bigint,
  liabilityRoomWei: bigint,
  payoutRate: bigint,
): V2LockQuote {
  const noRoom = liabilityRoomWei === BigInt(0) || playAmountWei === BigInt(0) || payoutRate === BigInt(0);

  if (noRoom) {
    return {
      playAmountWei,
      payoutRate,
      liabilityRoomWei,
      requestedLiabilityWei: BigInt(0),
      actualLiabilityWei: BigInt(0),
      actualStakeWei: BigInt(0),
      lockFeeWei: BigInt(0),
      netStakeWei: BigInt(0),
      payoutIfWinWei: BigInt(0),
      refundWei: playAmountWei,
      partialFill: false,
      noRoom: true,
    };
  }

  const requestedLiabilityWei = (playAmountWei * payoutRate) / BigInt(10);
  const actualLiabilityWei =
    requestedLiabilityWei > liabilityRoomWei ? liabilityRoomWei : requestedLiabilityWei;
  const actualStakeWei = (actualLiabilityWei * BigInt(10)) / payoutRate;
  const lockFeeWei = (actualStakeWei * BigInt(V2_LOCK_FEE_BPS)) / BigInt(10_000);
  const netStakeWei = actualStakeWei - lockFeeWei;
  const payoutIfWinWei = (netStakeWei * payoutRate) / BigInt(10);
  const refundWei = playAmountWei > actualStakeWei ? playAmountWei - actualStakeWei : BigInt(0);
  const partialFill = refundWei > BigInt(0);

  return {
    playAmountWei,
    payoutRate,
    liabilityRoomWei,
    requestedLiabilityWei,
    actualLiabilityWei,
    actualStakeWei,
    lockFeeWei,
    netStakeWei,
    payoutIfWinWei,
    refundWei,
    partialFill,
    noRoom: actualLiabilityWei === BigInt(0),
  };
}

/** Max `playAmount` that fully fits in `liabilityRoom` at this payout rate. */
export function maxPlayAmountForLiabilityRoom(liabilityRoomWei: bigint, payoutRate: bigint): bigint {
  if (liabilityRoomWei === BigInt(0) || payoutRate === BigInt(0)) return BigInt(0);
  return (liabilityRoomWei * BigInt(10)) / payoutRate;
}

export function payoutMultiplierLabel(payoutRate: bigint): string {
  const n = Number(payoutRate);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const mult = n / 10;
  return mult % 1 === 0 ? `${mult}×` : `${mult.toFixed(1)}×`;
}
