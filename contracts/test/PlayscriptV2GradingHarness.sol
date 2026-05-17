// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {PlayscriptV2Grading} from "../v2/PlayscriptV2Grading.sol";
import {PlayscriptPayout} from "../v2/PlayscriptPayout.sol";

contract PlayscriptV2GradingHarness {
    function resolveSoccer(
        uint256 finalHome,
        uint256 finalAway,
        uint256 htHome,
        uint256 htAway,
        uint256 yellowHome,
        uint256 yellowAway
    ) external pure returns (uint16) {
        uint8[12] memory kinds = [
            uint8(1),
            uint8(2),
            uint8(4),
            uint8(7),
            uint8(9),
            uint8(11),
            uint8(13),
            uint8(16),
            uint8(17),
            uint8(20),
            uint8(21),
            uint8(12)
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
