// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPlayscriptScheduler} from "../v2/IPlayscriptScheduler.sol";

/// @notice No-op scheduler for Hardhat tests (kernel `registerMatch` wiring).
contract MockScheduler is IPlayscriptScheduler {
    uint256 public callCount;

    function scheduleMatch(uint256, uint64, uint64) external override {
        callCount++;
    }

    function scheduleSettleRetry(uint256, uint64) external override {
        callCount++;
    }
}
