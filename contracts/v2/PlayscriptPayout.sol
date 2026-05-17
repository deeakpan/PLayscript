// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title PlayscriptPayout
/// @notice Difficulty score → payout multiplier (`playscript.md` §10). Rate is ×10 (70 = 7.0×).
library PlayscriptPayout {
    function payoutRate(uint256 score) internal pure returns (uint256) {
        if (score <= 50) return 18;
        if (score <= 55) return 22;
        if (score <= 60) return 28;
        if (score <= 65) return 35;
        if (score <= 70) return 45;
        if (score <= 75) return 55;
        if (score <= 80) return 70;
        if (score <= 90) return 90;
        if (score <= 100) return 120;
        if (score <= 110) return 150;
        if (score <= 120) return 180;
        return 200;
    }

    function payoutAmount(uint256 netStake, uint256 rate) internal pure returns (uint256) {
        return (netStake * rate) / 10;
    }
}
