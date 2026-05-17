// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {SomniaEventHandler} from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";
import {SomniaExtensions} from "@somnia-chain/reactivity-contracts/contracts/interfaces/SomniaExtensions.sol";
import {ISomniaReactivityPrecompile} from "@somnia-chain/reactivity-contracts/contracts/interfaces/ISomniaReactivityPrecompile.sol";

import {BrimdexFeedAssets} from "./BrimdexFeedAssets.sol";
import {IBrimdexFeedAgentPuller} from "./IBrimdexFeedAgentPuller.sol";

/// @title BrimdexReactivityCoordinator
/// @notice Timestamp reactivity: each tick calls `pull` on sixteen `BrimdexFeedAgentPuller` contracts (sixteen
///         separate Somnia agent requests per tick, not one batched call).
/// @dev Same funding idea as `TickCounterHost` / `PlayscriptReactivityHost`: hold **native on this contract**
///      (≥ ~32 STT on testnet per team notes) so Somnia can bill **subscription + reactive tick gas** from the
///      handler balance. Agent **request** deposits still come from **each puller**, not from here.
contract BrimdexReactivityCoordinator is SomniaEventHandler {
    uint256 public immutable intervalSeconds;
    address public immutable trustedBinder;

    bool public started;
    uint64 public tickCount;
    uint256 public lastScheduleMillis;

    address[16] private _pullers;
    bool public pullersRegistered;

    event Ticked(uint64 indexed count, uint256 scheduleMillis);
    event NextScheduled(uint256 scheduleMillis, uint256 subscriptionId);
    event PricePullRequested(uint64 indexed tick, uint8 indexed assetId, string diaKey, string url);
    event PullersRegistered(address[16] pullers);

    error BadInterval();
    error AlreadyStarted();
    error Unauthorized();
    error BadConfig();
    error PullersAlreadyRegistered();
    error NativeSendFailed();

    event NativeWithdrawn(address indexed to, uint256 amount);

    constructor(uint256 intervalSeconds_, address trustedBinder_) payable {
        if (intervalSeconds_ < 2 || intervalSeconds_ > 7 days) revert BadInterval();
        if (trustedBinder_ == address(0)) revert BadConfig();
        intervalSeconds = intervalSeconds_;
        trustedBinder = trustedBinder_;
    }

    receive() external payable {}

    function puller(uint8 assetId) external view returns (address) {
        if (assetId >= BrimdexFeedAssets.ASSET_COUNT) revert BrimdexFeedAssets.BadAsset();
        return _pullers[assetId];
    }

    function registerPullers(address[16] calldata pullers_) external {
        if (msg.sender != trustedBinder) revert Unauthorized();
        if (pullersRegistered) revert PullersAlreadyRegistered();
        for (uint8 i = 0; i < BrimdexFeedAssets.ASSET_COUNT; ++i) {
            if (pullers_[i] == address(0)) revert BadConfig();
            _pullers[i] = pullers_[i];
        }
        pullersRegistered = true;
        emit PullersRegistered(pullers_);
    }

    function start() external {
        if (started) revert AlreadyStarted();
        if (!pullersRegistered) revert BadConfig();
        started = true;
        _scheduleNext(_futureMillisFromNow(intervalSeconds));
    }

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

        for (uint8 i = 0; i < BrimdexFeedAssets.ASSET_COUNT; ++i) {
            emit PricePullRequested(tickCount, i, BrimdexFeedAssets.diaKeyOf(i), BrimdexFeedAssets.feedUrl(i));
            IBrimdexFeedAgentPuller(_pullers[i]).pull(tickCount);
        }

        _scheduleNext(_futureMillisFromNow(intervalSeconds));
    }

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
            gasLimit: 30_000_000
        });

        uint256 subId = SomniaExtensions.scheduleSubscriptionAtTimestamp(address(this), timestampMillis, opts);
        lastScheduleMillis = timestampMillis;
        emit NextScheduled(timestampMillis, subId);
    }

    /// @notice Rescue native (STT). Only `trustedBinder` (same address as `BRIMDEX_UPDATER` at deploy).
    function withdrawNative(address payable to, uint256 amount) external {
        if (msg.sender != trustedBinder) revert Unauthorized();
        _withdrawNative(to, amount);
    }

    function withdrawNativeAll(address payable to) external {
        if (msg.sender != trustedBinder) revert Unauthorized();
        _withdrawNative(to, address(this).balance);
    }

    function _withdrawNative(address payable to, uint256 amount) private {
        if (to == address(0)) revert BadConfig();
        if (amount > address(this).balance) revert BadConfig();
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert NativeSendFailed();
        emit NativeWithdrawn(to, amount);
    }
}
