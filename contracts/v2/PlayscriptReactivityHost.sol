// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {SomniaEventHandler} from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";
import {SomniaExtensions} from "@somnia-chain/reactivity-contracts/contracts/interfaces/SomniaExtensions.sol";
import {ISomniaReactivityPrecompile} from "@somnia-chain/reactivity-contracts/contracts/interfaces/ISomniaReactivityPrecompile.sol";

import {IPlayscriptScheduler} from "./IPlayscriptScheduler.sol";
import {PlayscriptKernel} from "./PlayscriptKernel.sol";

/// @title PlayscriptReactivityHost
/// @notice Owns Somnia timestamp subscriptions for kickoff lock + resolution trigger. Fund with SOMI (≥32 for subscribe + ongoing gas).
/// @dev Uses `unixSeconds * 1000 + (matchId % 997)` ms jitter so Schedule topics stay distinct across matches.
contract PlayscriptReactivityHost is SomniaEventHandler, IPlayscriptScheduler {
    PlayscriptKernel public immutable kernel;

    /// @dev millis → matchId + 1 (zero means unset). Separate maps disambiguate kick vs resolve vs retry callbacks.
    mapping(uint256 => uint256) private _kickMillisToMatch;
    mapping(uint256 => uint256) private _resolveMillisToMatch;
    mapping(uint256 => uint256) private _retryMillisToMatch;

    /// @dev Jitter offset for settle-retry schedules (distinct from resolve `+ 500`).
    uint256 private constant RETRY_MILLIS_OFFSET = 1000;

    /// @dev `startSettle` runs 5 agent `createRequest` calls inside `onEvent`; default 10M OOGs on resolve.
    uint64 private constant HANDLER_GAS_LIMIT = 30_000_000;

    event SchedulesRegistered(
        uint256 indexed matchId,
        uint256 kickSubscriptionId,
        uint256 resolveSubscriptionId,
        uint256 kickMillis,
        uint256 resolveMillis
    );

    event SettleRetryRegistered(uint256 indexed matchId, uint256 subscriptionId, uint256 retryMillis);

    error OnlyKernel();
    error KernelZero();
    error Unauthorized();
    error WithdrawFailed();

    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(PlayscriptKernel kernel_) payable {
        if (address(kernel_) == address(0)) revert KernelZero();
        kernel = kernel_;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    receive() external payable {}

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert Unauthorized();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Owner: send native balance out (e.g. unused SOMI on the host).
    function withdrawNative(address payable to, uint256 amount) external onlyOwner {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert WithdrawFailed();
    }

    /// @inheritdoc IPlayscriptScheduler
    function scheduleMatch(uint256 matchId, uint64 kickoffSec, uint64 finalizeAfterSec) external override {
        if (msg.sender != address(kernel)) revert OnlyKernel();

        uint256 kickMillis = uint256(kickoffSec) * 1000 + (matchId % 997);
        uint256 resolveMillis = uint256(finalizeAfterSec) * 1000 + (matchId % 997) + 500;

        SomniaExtensions.SubscriptionOptions memory opts = SomniaExtensions.SubscriptionOptions({
            priorityFeePerGas: SomniaExtensions.DEFAULT_PRIORITY_FEE_PER_GAS,
            maxFeePerGas: SomniaExtensions.DEFAULT_MAX_FEE_PER_GAS,
            gasLimit: HANDLER_GAS_LIMIT
        });

        uint256 subKick = SomniaExtensions.scheduleSubscriptionAtTimestamp(address(this), kickMillis, opts);
        uint256 subResolve = SomniaExtensions.scheduleSubscriptionAtTimestamp(address(this), resolveMillis, opts);

        _kickMillisToMatch[kickMillis] = matchId + 1;
        _resolveMillisToMatch[resolveMillis] = matchId + 1;

        emit SchedulesRegistered(matchId, subKick, subResolve, kickMillis, resolveMillis);
    }

    /// @inheritdoc IPlayscriptScheduler
    function scheduleSettleRetry(uint256 matchId, uint64 settleAfterSec) external override {
        if (msg.sender != address(kernel)) revert OnlyKernel();

        uint256 retryMillis = uint256(settleAfterSec) * 1000 + (matchId % 997) + RETRY_MILLIS_OFFSET;

        SomniaExtensions.SubscriptionOptions memory opts = SomniaExtensions.SubscriptionOptions({
            priorityFeePerGas: SomniaExtensions.DEFAULT_PRIORITY_FEE_PER_GAS,
            maxFeePerGas: SomniaExtensions.DEFAULT_MAX_FEE_PER_GAS,
            gasLimit: HANDLER_GAS_LIMIT
        });

        uint256 subRetry = SomniaExtensions.scheduleSubscriptionAtTimestamp(address(this), retryMillis, opts);
        _retryMillisToMatch[retryMillis] = matchId + 1;

        emit SettleRetryRegistered(matchId, subRetry, retryMillis);
    }

    /// @dev Somnia passes `eventTopics[1]` from the synthetic `Schedule` log; it should equal the millis
    ///      passed to `scheduleSubscriptionAtTimestamp`, but some nodes coalesce to second boundaries. We
    ///      therefore try the exact key first, then every jitter offset for that second (see `scheduleMatch`).
    function _lookupKickPacked(uint256 tsMillis) private view returns (uint256 packed) {
        packed = _kickMillisToMatch[tsMillis];
        if (packed != 0) return packed;
        uint256 base = (tsMillis / 1000) * 1000;
        for (uint256 j = 0; j < 997; ++j) {
            packed = _kickMillisToMatch[base + j];
            if (packed != 0) return packed;
        }
        return 0;
    }

    /// @dev Same idea as kick lookup, but resolve keys are `finalizeAfterSec * 1000 + jitter + 500`, so the
    ///      stored ms can fall in the **next** unix second while `eventTopics[1]` may round to the previous
    ///      second (or ±1s). Probe `finalizeAfterSec` in a window around `tsMillis / 1000`, not only two
    ///      adjacent `base` millis stripes.
    function _lookupResolvePacked(uint256 tsMillis) private view returns (uint256 packed) {
        packed = _resolveMillisToMatch[tsMillis];
        if (packed != 0) return packed;
        uint256 centerSec = tsMillis / 1000;
        uint256 startSec = centerSec > 2 ? centerSec - 2 : 0;
        uint256 endSec = centerSec + 2;
        for (uint256 fs = startSec; fs <= endSec; ++fs) {
            uint256 base = fs * 1000;
            for (uint256 j = 0; j < 997; ++j) {
                packed = _resolveMillisToMatch[base + j + 500];
                if (packed != 0) return packed;
            }
        }
        return 0;
    }

    function _lookupRetryPacked(uint256 tsMillis) private view returns (uint256 packed) {
        packed = _retryMillisToMatch[tsMillis];
        if (packed != 0) return packed;
        uint256 centerSec = tsMillis / 1000;
        uint256 startSec = centerSec > 2 ? centerSec - 2 : 0;
        uint256 endSec = centerSec + 2;
        for (uint256 fs = startSec; fs <= endSec; ++fs) {
            uint256 base = fs * 1000;
            for (uint256 j = 0; j < 997; ++j) {
                packed = _retryMillisToMatch[base + j + RETRY_MILLIS_OFFSET];
                if (packed != 0) return packed;
            }
        }
        return 0;
    }

    /// @inheritdoc SomniaEventHandler
    function _onEvent(address emitter, bytes32[] calldata eventTopics, bytes calldata data) internal override {
        emitter;
        data;
        // `SomniaEventHandler.onEvent` already requires `msg.sender == 0x0100`. The `emitter` argument is the
        // log address field; Somnia docs use `0x0100` for system Schedule filters, but do not guarantee the
        // synthetic log’s `address` always equals that constant across node versions — do not gate on it.
        if (eventTopics.length < 2) return;
        if (eventTopics[0] != ISomniaReactivityPrecompile.Schedule.selector) return;

        uint256 tsMillis = uint256(eventTopics[1]);

        uint256 kickPacked = _lookupKickPacked(tsMillis);
        if (kickPacked != 0) {
            kernel.lockKickoff(kickPacked - 1);
            return;
        }

        uint256 resolvePacked = _lookupResolvePacked(tsMillis);
        if (resolvePacked != 0) {
            kernel.startSettle(resolvePacked - 1);
            return;
        }

        uint256 retryPacked = _lookupRetryPacked(tsMillis);
        if (retryPacked != 0) {
            kernel.startSettle(retryPacked - 1);
        }
    }
}
