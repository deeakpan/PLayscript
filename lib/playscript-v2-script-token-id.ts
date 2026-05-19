import { encodePacked, keccak256 } from "viem";

/** Same as `PlayscriptV2Positions.scriptTokenId(matchId, legMask12)`. */
export function v2ScriptTokenId(matchId: bigint, legMask12: number): bigint {
  return BigInt(keccak256(encodePacked(["uint256", "uint16"], [matchId, legMask12])));
}
