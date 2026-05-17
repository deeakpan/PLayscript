// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {SomniaEventHandler} from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";
import {SomniaExtensions} from "@somnia-chain/reactivity-contracts/contracts/interfaces/SomniaExtensions.sol";
import {ISomniaReactivityPrecompile} from "@somnia-chain/reactivity-contracts/contracts/interfaces/ISomniaReactivityPrecompile.sol";

/// @title TickCounterHost
/// @notice **Outside Playscript** — minimal Somnia Reactivity demo: fires on a wall-clock interval by
///         chaining `scheduleSubscriptionAtTimestamp` (each tick schedules the next).
/// @dev Fund the contract with ≥32 native (SOMI) before `start()` — same subscriber balance rule as other hosts.
///      `intervalSeconds` must be ≥2 so the next timestamp passes the precompile “not in past” check.
contract TickCounterHost is SomniaEventHandler {
    uint256 public immutable intervalSeconds;

    bool public started;
    uint64 public tickCount;
    uint256 public lastScheduleMillis;

    event Ticked(uint64 indexed count, uint256 scheduleMillis);
    event NextScheduled(uint256 scheduleMillis, uint256 subscriptionId);

    error BadInterval();
    error AlreadyStarted();

    constructor(uint256 intervalSeconds_) payable {
        if (intervalSeconds_ < 2 || intervalSeconds_ > 7 days) revert BadInterval();
        intervalSeconds = intervalSeconds_;
    }

    receive() external payable {}

    /// @notice Arm the first schedule. Callable once; contract must already hold enough native for subscriptions.
    function start() external {
        if (started) revert AlreadyStarted();
        started = true;
        _scheduleNext(_futureMillisFromNow(intervalSeconds));
    }

    /// @inheritdoc SomniaEventHandler
    function _onEvent(address emitter, bytes32[] calldata eventTopics, bytes calldata data) internal override {
        emitter;
        data;
        if (emitter != SomniaExtensions.SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS) return;
        if (eventTopics.length < 2) return;
        if (eventTopics[0] != ISomniaReactivityPrecompile.Schedule.selector) return;

        uint256 tsMillis = uint256(eventTopics[1]);
        if (tsMillis != lastScheduleMillis) return;

        unchecked {
            ++tickCount;
        }
        emit Ticked(tickCount, tsMillis);

        _scheduleNext(_futureMillisFromNow(intervalSeconds));
    }

    /// @dev `deltaSec` seconds from `block.timestamp`, adjusted upward to satisfy SomniaExtensions.TimestampInPast.
    function _futureMillisFromNow(uint256 deltaSec) private view returns (uint256 millis) {
        millis = (uint256(block.timestamp) + deltaSec) * 1000;
        uint256 minAllowed = (uint256(block.timestamp) + 1) * 1000 + 1;
        if (millis < minAllowed) {
            millis = minAllowed;
        }
    }

    function _scheduleNext(uint256 timestampMillis) private {
        SomniaExtensions.SubscriptionOptions memory opts = SomniaExtensions.SubscriptionOptions({
            priorityFeePerGas: SomniaExtensions.DEFAULT_PRIORITY_FEE_PER_GAS,
            maxFeePerGas: SomniaExtensions.DEFAULT_MAX_FEE_PER_GAS,
            gasLimit: 2_000_000
        });

        uint256 subId = SomniaExtensions.scheduleSubscriptionAtTimestamp(address(this), timestampMillis, opts);
        lastScheduleMillis = timestampMillis;
        emit NextScheduled(timestampMillis, subId);
    }
}
