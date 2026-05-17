// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Registers Somnia Reactivity timestamp callbacks for a match (kickoff lock + resolution window).
interface IPlayscriptScheduler {
    /// @param matchId On-chain match id assigned by the kernel.
    /// @param kickoffSec Unix seconds for kickoff (wall-clock used with TheSportsDB).
    /// @param finalizeAfterSec Unix seconds when resolution may begin (`kickoff + finalizeDelay` on the kernel).
    function scheduleMatch(uint256 matchId, uint64 kickoffSec, uint64 finalizeAfterSec) external;

    /// @notice One-shot Schedule callback to retry `startSettle` after a failed agent fetch.
    /// @param settleAfterSec Unix seconds when the retry may run (kernel updates `finalizeDelaySec` to match).
    function scheduleSettleRetry(uint256 matchId, uint64 settleAfterSec) external;
}
