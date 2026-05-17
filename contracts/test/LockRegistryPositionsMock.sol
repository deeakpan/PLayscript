// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {PlayscriptV2LockRegistry} from "../v2/PlayscriptV2LockRegistry.sol";

/// @dev Test helper — stands in for `PlayscriptV2Positions` when testing the registry.
contract LockRegistryPositionsMock {
  function recordLock(
    PlayscriptV2LockRegistry registry,
    address user,
    uint256 matchId,
    uint16 legMask12,
    uint256 actualStake,
    uint256 netStake,
    uint256 payoutRate
  ) external {
    registry.recordLock(user, matchId, legMask12, actualStake, netStake, payoutRate);
  }

  function markClaimed(PlayscriptV2LockRegistry registry, address user, uint256 matchId, uint16 legMask12) external {
    registry.markClaimed(user, matchId, legMask12);
  }
}
