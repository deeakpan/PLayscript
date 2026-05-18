// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {PlayscriptV2Grading} from "../v2/PlayscriptV2Grading.sol";
import {PlayscriptPayout} from "../v2/PlayscriptPayout.sol";

contract PlayscriptV2GradingHarness {
    /// @dev Mirrors `V2_SOCCER_MARKET_LEG_KINDS` in `lib/playscript-v2-leg-kinds.ts`.
    function resolveSoccerMarket(
        uint256 finalHome,
        uint256 finalAway,
        uint256 htHome,
        uint256 htAway,
        uint256 yellowHome,
        uint256 yellowAway
    ) external pure returns (uint16) {
        uint8[15] memory kinds = [
            uint8(1),
            uint8(2),
            uint8(3),
            uint8(13),
            uint8(14),
            uint8(15),
            uint8(4),
            uint8(36),
            uint8(25),
            uint8(26),
            uint8(6),
            uint8(7),
            uint8(8),
            uint8(37),
            uint8(39)
        ];
        PlayscriptV2Grading.Facts memory f = PlayscriptV2Grading.Facts({
            finalHome: finalHome,
            finalAway: finalAway,
            htHome: htHome,
            htAway: htAway,
            yellowHome: yellowHome,
            yellowAway: yellowAway,
            redHome: 0,
            redAway: 0,
            homeQ1: 0,
            homeQ2: 0,
            awayQ1: 0,
            awayQ2: 0
        });
        return PlayscriptV2Grading.resolveMask(0, kinds, f);
    }

    function payoutRate(uint256 score) external pure returns (uint256) {
        return PlayscriptPayout.payoutRate(score);
    }

    function payoutAmount(uint256 netStake, uint256 rate) external pure returns (uint256) {
        return PlayscriptPayout.payoutAmount(netStake, rate);
    }
}
