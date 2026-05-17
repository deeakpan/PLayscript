// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Called by `BrimdexReactivityCoordinator` on each tick (one Somnia agent request per puller).
interface IBrimdexFeedAgentPuller {
    function pull(uint64 tick) external;
}
