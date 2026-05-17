import { Address } from "@graphprotocol/graph-ts";

import {
  ScriptClaimed as ScriptClaimedEvent,
  ScriptLocked as ScriptLockedEvent,
  TransferSingle as TransferSingleEvent,
} from "../generated/PlayscriptV2Positions/PlayscriptV2Positions";
import { ScriptClaim, ScriptLock, ScriptUnwind } from "../generated/schema";
import {
  ZERO_ADDRESS,
  claimIdForTx,
  eventId,
  getOrCreateMatchStub,
  getOrCreateUser,
  scriptTokenId,
} from "./helpers";

export function handleScriptLocked(event: ScriptLockedEvent): void {
  const id = eventId(event.transaction.hash, event.logIndex);
  if (ScriptLock.load(id) != null) return;

  const match = getOrCreateMatchStub(event.params.matchId, event.block);
  const user = getOrCreateUser(event.params.user);

  const lock = new ScriptLock(id);
  lock.user = user.id;
  lock.match = match.id;
  lock.matchId = event.params.matchId;
  lock.legMask12 = event.params.legMask12;
  lock.tokenId = scriptTokenId(event.params.matchId, event.params.legMask12);
  lock.actualStake = event.params.actualStake;
  lock.netStake = event.params.netStake;
  lock.payoutRate = event.params.payoutRate;
  lock.liability = event.params.liability;
  lock.blockNumber = event.block.number;
  lock.blockTimestamp = event.block.timestamp;
  lock.transactionHash = event.transaction.hash;
  lock.save();
}

export function handleScriptClaimed(event: ScriptClaimedEvent): void {
  const id = claimIdForTx(event.transaction.hash);
  let claim = ScriptClaim.load(id);

  const match = getOrCreateMatchStub(event.params.matchId, event.block);
  const user = getOrCreateUser(event.params.user);

  if (claim == null) {
    claim = new ScriptClaim(id);
    claim.user = user.id;
    claim.match = match.id;
    claim.matchId = event.params.matchId;
    claim.legMask12 = event.params.legMask12;
    claim.blockNumber = event.block.number;
    claim.blockTimestamp = event.block.timestamp;
    claim.transactionHash = event.transaction.hash;
  }

  claim.netStakeBurned = event.params.netStakeBurned;
  claim.save();
}

export function handleTransferSingle(event: TransferSingleEvent): void {
  if (event.params.to != Address.fromString(ZERO_ADDRESS)) return;
  if (event.params.from == Address.fromString(ZERO_ADDRESS)) return;

  const id = eventId(event.transaction.hash, event.logIndex);
  if (ScriptUnwind.load(id) != null) return;

  const user = getOrCreateUser(event.params.from);
  const unwind = new ScriptUnwind(id);
  unwind.user = user.id;
  unwind.tokenId = event.params.id;
  unwind.amount = event.params.value;
  unwind.blockNumber = event.block.number;
  unwind.blockTimestamp = event.block.timestamp;
  unwind.transactionHash = event.transaction.hash;
  unwind.save();
}
