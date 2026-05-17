import { BigInt } from "@graphprotocol/graph-ts";

import {
  MatchRegistered as MatchRegisteredEvent,
  MatchSettled as MatchSettledEvent,
  ScriptPaid as ScriptPaidEvent,
} from "../generated/PlayscriptKernel/PlayscriptKernel";
import { Match, ScriptClaim } from "../generated/schema";
import {
  claimIdForTx,
  getOrCreateMatchStub,
  getOrCreateUser,
  matchEntityId,
} from "./helpers";

export function handleMatchRegistered(event: MatchRegisteredEvent): void {
  const matchId = event.params.matchId;
  const id = matchEntityId(matchId);

  let match = Match.load(id);
  if (match == null) {
    match = new Match(id);
  }

  match.matchId = matchId;
  match.sport = event.params.sport;
  match.kickoff = event.params.kickoff;
  match.finalizeDelaySec = event.params.finalizeDelaySec.toI32();
  match.finalizeAfterSec = event.params.finalizeAfterSec;
  match.url = event.params.url;
  match.settled = false;
  match.registeredAt = event.block.timestamp;
  match.registeredBlock = event.block.number;
  match.save();
}

export function handleMatchSettled(event: MatchSettledEvent): void {
  const match = getOrCreateMatchStub(event.params.matchId, event.block);
  match.settled = true;
  match.finalHome = event.params.finalHome;
  match.finalAway = event.params.finalAway;
  match.resolvedLegsBitmask = BigInt.fromI32(<i32>event.params.resolvedLegsBitmask);
  match.save();
}

export function handleScriptPaid(event: ScriptPaidEvent): void {
  const id = claimIdForTx(event.transaction.hash);
  let claim = ScriptClaim.load(id);

  if (claim == null) {
    const match = getOrCreateMatchStub(event.params.matchId, event.block);
    const user = getOrCreateUser(event.params.to);
    claim = new ScriptClaim(id);
    claim.user = user.id;
    claim.match = match.id;
    claim.matchId = event.params.matchId;
    claim.legMask12 = event.params.legMask12;
    claim.netStakeBurned = BigInt.zero();
    claim.blockNumber = event.block.number;
    claim.blockTimestamp = event.block.timestamp;
    claim.transactionHash = event.transaction.hash;
  }

  claim.payout = event.params.payout;
  claim.save();
}
