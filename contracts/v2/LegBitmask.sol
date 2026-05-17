// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Helpers for 12-leg picks (bits 0–11). Users lock exactly 5 bits set.
library LegBitmask {
    /// @dev Count set bits in the low 12 bits of `mask`.
    function popCount12(uint16 mask) internal pure returns (uint256 c) {
        unchecked {
            for (uint256 i; i < 12; ++i) {
                if ((mask >> i) & 1 == 1) ++c;
            }
        }
    }

    /// @dev True iff exactly `bits` bits are set among the low 12 bits.
    function hasExactBits(uint16 mask, uint256 bits) internal pure returns (bool) {
        return popCount12(mask) == bits;
    }
}
