// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title PlayscriptV2Grading
/// @notice Grade v2 legs by stable `legKind` ids (`lib/playscript-v2-leg-kinds.ts`).
library PlayscriptV2Grading {
    struct Facts {
        uint256 finalHome;
        uint256 finalAway;
        uint256 htHome;
        uint256 htAway;
        uint256 yellowHome;
        uint256 yellowAway;
        uint256 redHome;
        uint256 redAway;
        uint256 homeQ1;
        uint256 homeQ2;
        uint256 awayQ1;
        uint256 awayQ2;
    }

    function legHitByKind(uint8 sport, uint8 kind, Facts memory f) internal pure returns (bool) {
        if (sport == 0) return _soccerKind(kind, f);
        if (sport == 1) return _basketballKind(kind, f);
        if (sport == 2) return _nflKind(kind, f);
        if (sport == 3) return _mlbKind(kind, f);
        return false;
    }

    uint8 internal constant MARKET_LEGS = 15;

    function resolveMask(uint8 sport, uint8[15] memory legKinds, Facts memory f) internal pure returns (uint16 mask) {
        unchecked {
            for (uint8 i; i < MARKET_LEGS; ++i) {
                if (legHitByKind(sport, legKinds[i], f)) {
                    mask |= uint16(1) << i;
                }
            }
        }
    }

    function _soccerKind(uint8 k, Facts memory f) private pure returns (bool) {
        uint256 h = f.finalHome;
        uint256 a = f.finalAway;
        uint256 ht = f.htHome + f.htAway;
        uint256 yc = f.yellowHome + f.yellowAway;
        if (k == 1) return h > a;
        if (k == 2) return a > h;
        if (k == 3) return h == a;
        if (k == 4) return h + a >= 3;
        if (k == 5) return h + a <= 1;
        if (k == 36) return h + a <= 2;
        if (k == 6) return h >= 1 && a >= 1;
        if (k == 7) return a == 0;
        if (k == 8) return h == 0;
        if (k == 9) return h > a && h - a >= 2;
        if (k == 10) return a > h && a - h >= 2;
        if (k == 11) return ht >= 1;
        if (k == 12) return h < 3 && a < 3;
        if (k == 13) return f.htHome > f.htAway;
        if (k == 14) return f.htAway > f.htHome;
        if (k == 15) return f.htHome == f.htAway;
        if (k == 16) return yc >= 2;
        if (k == 20) return f.htHome >= 1;
        if (k == 21) return f.htAway >= 1;
        if (k == 23) return f.redHome >= 1;
        if (k == 24) return f.redAway >= 1;
        if (k == 25) return ht >= 2;
        if (k == 26) return ht == 0;
        if (k == 27) return f.htAway == 0;
        if (k == 28) return f.htHome == 0;
        if (k == 29) return h >= 2;
        if (k == 30) return a >= 2;
        if (k == 31) return f.yellowHome >= 1;
        if (k == 32) return f.yellowAway >= 1;
        if (k == 33) return f.yellowHome >= 2;
        if (k == 34) return f.yellowAway >= 2;
        if (k == 35) return f.yellowHome >= 1 && f.yellowAway >= 1;
        if (k == 37) return _soccerSecondHalfTotal(f) >= 2;
        if (k == 39) return f.finalHome > f.htHome && f.finalAway > f.htAway;
        return false;
    }

    function _soccerSecondHalfTotal(Facts memory f) private pure returns (uint256) {
        return (f.finalHome - f.htHome) + (f.finalAway - f.htAway);
    }

    function _basketballKind(uint8 k, Facts memory f) private pure returns (bool) {
        uint256 h = f.finalHome;
        uint256 a = f.finalAway;
        uint256 t = h + a;
        uint256 h1h = f.homeQ1 + f.homeQ2;
        uint256 a1h = f.awayQ1 + f.awayQ2;
        uint256 q1 = f.homeQ1 + f.awayQ1;
        if (k == 41) return h > a;
        if (k == 42) return a > h;
        if (k == 43) return t >= 226;
        if (k == 44) return t <= 200;
        if (k == 45) return h >= 100 && a >= 100;
        if (k == 46) return h < 120 && a < 120;
        if (k == 47) return h > a && h - a >= 10;
        if (k == 48) return a > h && a - h >= 10;
        if (k == 49) return h1h + a1h >= 116;
        if (k == 50) return t >= 230;
        if (k == 51) {
            uint256 m = h > a ? h - a : a - h;
            return m >= 20;
        }
        if (k == 52) return h < 110 && a < 110;
        if (k == 53) return q1 >= 56;
        if (k == 54) return f.homeQ1 >= 28;
        if (k == 55) return f.awayQ1 >= 28;
        return false;
    }

    function _nflKind(uint8 k, Facts memory f) private pure returns (bool) {
        uint256 h = f.finalHome;
        uint256 a = f.finalAway;
        uint256 t = h + a;
        uint256 h1h = f.homeQ1 + f.homeQ2;
        uint256 a1h = f.awayQ1 + f.awayQ2;
        uint256 q1 = f.homeQ1 + f.awayQ1;
        if (k == 61) return h > a;
        if (k == 62) return a > h;
        if (k == 63) return t >= 46;
        if (k == 64) return t <= 38;
        if (k == 65) return h >= 17 && a >= 17;
        if (k == 66) return a <= 10;
        if (k == 67) return h <= 10;
        if (k == 68) {
            uint256 m = h > a ? h - a : a - h;
            return m >= 10;
        }
        if (k == 69) return h1h + a1h >= 24;
        if (k == 70) return h >= 24 && a >= 24;
        if (k == 71) return t >= 55;
        if (k == 72) return h == 0 || a == 0;
        if (k == 73) return q1 >= 15;
        if (k == 74) return h >= 20;
        if (k == 75) return a >= 20;
        return false;
    }

    function _mlbKind(uint8 k, Facts memory f) private pure returns (bool) {
        uint256 h = f.finalHome;
        uint256 a = f.finalAway;
        uint256 t = h + a;
        if (k == 81) return h > a;
        if (k == 82) return a > h;
        if (k == 83) return t >= 10;
        if (k == 84) return t <= 7;
        if (k == 85) return h >= 4 && a >= 4;
        if (k == 86) return h >= 5;
        if (k == 87) return a >= 5;
        if (k == 88) return t >= 10;
        if (k == 89) {
            uint256 m = h > a ? h - a : a - h;
            return m >= 3;
        }
        if (k == 90) return h >= 1 && a >= 1;
        if (k == 91) return h == 0 || a == 0;
        if (k == 92) return h < 7 && a < 7;
        if (k == 93) return t >= 9;
        if (k == 94) return h >= 3;
        if (k == 95) return a >= 3;
        return false;
    }
}
