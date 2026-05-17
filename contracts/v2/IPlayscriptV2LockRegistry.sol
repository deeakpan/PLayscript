// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IPlayscriptV2LockRegistry {
  function recordLock(
    address user,
    uint256 matchId,
    uint16 legMask12,
    uint256 actualStake,
    uint256 netStake,
    uint256 payoutRate
  ) external;

  function markClaimed(address user, uint256 matchId, uint16 legMask12) external;
}
