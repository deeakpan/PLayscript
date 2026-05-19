/** Unix second when agents may call `settleMatch` (kickoff + finalize delay). */
export function v2SettlementEligibleAtSec(kickoffSec: number, finalizeDelaySec: number): number {
  return kickoffSec + finalizeDelaySec;
}
