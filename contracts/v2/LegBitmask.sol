// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Helpers for v2 market leg picks (15 slots, bits 0–14). Users lock exactly 5 bits set.
library LegBitmask {
    uint8 public constant MARKET_BITS = 15;

    /// @dev Count set bits in the low `MARKET_BITS` bits of `mask`.
    function popCount(uint16 mask) internal pure returns (uint256 c) {
        unchecked {
            for (uint256 i; i < MARKET_BITS; ++i) {
                if ((mask >> i) & 1 == 1) ++c;
            }
        }
    }

    /// @dev True iff exactly `bits` bits are set among the market leg slots.
    function hasExactBits(uint16 mask, uint256 bits) internal pure returns (bool) {
        return popCount(mask) == bits;
    }
}
