// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPlayscriptV2LockRegistry} from "./IPlayscriptV2LockRegistry.sol";

/// @title PlayscriptV2LockRegistry
/// @notice On-chain index of `lockScript` fills for paginated My Scripts reads (no log scan).
contract PlayscriptV2LockRegistry is IPlayscriptV2LockRegistry {
  struct LockRecord {
    address user;
    uint256 matchId;
    uint16 legMask12;
    uint256 actualStake;
    uint256 netStake;
    uint256 payoutRate;
    uint64 blockNumber;
  }

  address public immutable positions;

  uint256 public nextLockId = 1;
  mapping(uint256 => LockRecord) public locks;
  mapping(address => uint256[]) private _userLockIds;
  mapping(address => mapping(bytes32 => bool)) private _claimed;

  event LockRecorded(
    uint256 indexed lockId,
    address indexed user,
    uint256 indexed matchId,
    uint16 legMask12,
    uint256 actualStake,
    uint256 netStake,
    uint256 payoutRate
  );
  event OutcomeClaimed(address indexed user, uint256 indexed matchId, uint16 legMask12);

  error Unauthorized();
  error BadLimit();

  modifier onlyPositions() {
    if (msg.sender != positions) revert Unauthorized();
    _;
  }

  constructor(address positions_) {
    positions = positions_;
  }

  function userLockCount(address user) external view returns (uint256) {
    return _userLockIds[user].length;
  }

  function userLockIdAt(address user, uint256 index) external view returns (uint256) {
    return _userLockIds[user][index];
  }

  function isOutcomeClaimed(address user, uint256 matchId, uint16 legMask12) public view returns (bool) {
    return _claimed[user][_outcomeKey(matchId, legMask12)];
  }

  function getUserLocks(
    address user,
    uint256 offset,
    uint256 limit
  )
    external
    view
    returns (
      uint256[] memory lockIds,
      uint256[] memory matchIds,
      uint16[] memory legMask12s,
      uint256[] memory actualStakes,
      uint256[] memory netStakes,
      uint256[] memory payoutRates,
      uint64[] memory blockNumbers,
      bool[] memory claimedFlags
    )
  {
    uint256[] storage ids = _userLockIds[user];
    uint256 total = ids.length;
    if (offset >= total) {
      return (_emptyU256(), _emptyU256(), _emptyU16(), _emptyU256(), _emptyU256(), _emptyU256(), _emptyU64(), _emptyBool());
    }
    uint256 end = offset + limit;
    if (end > total) end = total;
    uint256 n = end - offset;
    if (n == 0) revert BadLimit();

    lockIds = new uint256[](n);
    matchIds = new uint256[](n);
    legMask12s = new uint16[](n);
    actualStakes = new uint256[](n);
    netStakes = new uint256[](n);
    payoutRates = new uint256[](n);
    blockNumbers = new uint64[](n);
    claimedFlags = new bool[](n);

    for (uint256 i; i < n; ++i) {
      uint256 lockId = ids[total - 1 - offset - i];
      LockRecord storage row = locks[lockId];
      lockIds[i] = lockId;
      matchIds[i] = row.matchId;
      legMask12s[i] = row.legMask12;
      actualStakes[i] = row.actualStake;
      netStakes[i] = row.netStake;
      payoutRates[i] = row.payoutRate;
      blockNumbers[i] = row.blockNumber;
      claimedFlags[i] = _claimed[user][_outcomeKey(row.matchId, row.legMask12)];
    }
  }

  function recordLock(
    address user,
    uint256 matchId,
    uint16 legMask12,
    uint256 actualStake,
    uint256 netStake,
    uint256 payoutRate
  ) external onlyPositions {
    uint256 lockId = nextLockId++;
    uint64 blockNumber = uint64(block.number);
    locks[lockId] = LockRecord({
      user: user,
      matchId: matchId,
      legMask12: legMask12,
      actualStake: actualStake,
      netStake: netStake,
      payoutRate: payoutRate,
      blockNumber: blockNumber
    });
    _userLockIds[user].push(lockId);
    emit LockRecorded(lockId, user, matchId, legMask12, actualStake, netStake, payoutRate);
  }

  function markClaimed(address user, uint256 matchId, uint16 legMask12) external onlyPositions {
    _claimed[user][_outcomeKey(matchId, legMask12)] = true;
    emit OutcomeClaimed(user, matchId, legMask12);
  }

  function _outcomeKey(uint256 matchId, uint16 legMask12) private pure returns (bytes32) {
    return keccak256(abi.encodePacked(matchId, legMask12));
  }

  function _emptyU256() private pure returns (uint256[] memory a) {
    return a;
  }

  function _emptyU16() private pure returns (uint16[] memory a) {
    return a;
  }

  function _emptyU64() private pure returns (uint64[] memory a) {
    return a;
  }

  function _emptyBool() private pure returns (bool[] memory a) {
    return a;
  }
}
