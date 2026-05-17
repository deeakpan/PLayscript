// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Kernel / positions integration surface (`playscript.md` §2 `IPlayVault` + stake custody).
interface IPlayVault {
    function PLAY() external view returns (address);
    function totalOutstandingLiability() external view returns (uint256);
    function addLiability(uint256 amount) external;
    function clearLiability(uint256 amount) external;
    function pay(address to, uint256 amount) external;
    function releaseStake(address to, uint256 amount) external;
}
