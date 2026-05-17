/**
 * Split vault PLAY balance into the same buckets implied by `PlayVault.freeFloat()`:
 * `freeFloat = max(0, balance - totalOutstandingLiability - (balance * HARD_FLOOR_BPS / 10_000))`.
 * So balance ≈ liability + hardFloorReserve + freeFloat (bigint; may differ by wei from rounding).
 */
export function partitionVaultPlay(
  vaultPlayBal: bigint,
  totalOutstandingLiability: bigint,
  freeFloat: bigint,
): { liability: bigint; hardFloor: bigint; freeFloat: bigint; total: bigint } {
  const z = BigInt(0);
  const bal = vaultPlayBal;
  if (bal <= z) {
    return { liability: z, hardFloor: z, freeFloat: z, total: z };
  }

  let liability = totalOutstandingLiability > bal ? bal : totalOutstandingLiability;
  const afterLiab = bal - liability;
  let free = freeFloat;
  if (free < z) free = z;
  if (free > afterLiab) free = afterLiab;
  let hardFloor = bal - liability - free;
  if (hardFloor < z) hardFloor = z;

  return { liability, hardFloor, freeFloat: free, total: bal };
}

/** Basis points of TVL that is not free float (liability + hard floor band). */
export function utilizedBps(liability: bigint, hardFloor: bigint, total: bigint): number {
  if (total <= BigInt(0)) return 0;
  const used = liability + hardFloor;
  return Number((used * BigInt(10000)) / total) / 100;
}
