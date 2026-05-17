import { Address, BigInt, Bytes, crypto, ethereum } from "@graphprotocol/graph-ts";

import { Match, User } from "../generated/schema";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function eventId(txHash: Bytes, logIndex: BigInt): string {
  return txHash.toHexString() + "-" + logIndex.toString();
}

/** One claim() tx — shared by `ScriptClaimed` (positions) and `ScriptPaid` (kernel). */
export function claimIdForTx(txHash: Bytes): string {
  return txHash.toHexString() + "-claim";
}

export function userId(address: Address): string {
  return address.toHexString().toLowerCase();
}

export function matchEntityId(matchId: BigInt): string {
  return matchId.toString();
}

export function getOrCreateUser(address: Address): User {
  const id = userId(address);
  let user = User.load(id);
  if (user == null) {
    user = new User(id);
    user.save();
  }
  return user;
}

/** `keccak256(abi.encodePacked(uint256 matchId, uint16 legMask12))`. */
export function scriptTokenId(matchId: BigInt, legMask12: i32): BigInt {
  let matchHex = matchId.toHexString().slice(2);
  while (matchHex.length < 64) {
    matchHex = "0" + matchHex;
  }
  let maskHex = legMask12.toString(16);
  while (maskHex.length < 4) {
    maskHex = "0" + maskHex;
  }
  const packed = Bytes.fromHexString("0x" + matchHex + maskHex);
  const hash = crypto.keccak256(packed);
  return BigInt.fromUnsignedBytes(Bytes.fromUint8Array(hash.subarray(0, 32)));
}

export function getOrCreateMatchStub(matchId: BigInt, block: ethereum.Block): Match {
  const id = matchEntityId(matchId);
  let match = Match.load(id);
  if (match == null) {
    match = new Match(id);
    match.matchId = matchId;
    match.sport = 0;
    match.kickoff = BigInt.zero();
    match.finalizeDelaySec = 0;
    match.finalizeAfterSec = BigInt.zero();
    match.url = "";
    match.settled = false;
    match.registeredAt = block.timestamp;
    match.registeredBlock = block.number;
    match.save();
  }
  return match;
}
