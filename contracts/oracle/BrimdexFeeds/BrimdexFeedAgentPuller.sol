// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAgentRequester, IJsonApiAgent, Request, Response, ResponseStatus} from "../../interfaces/ISomniaAgents.sol";
import {BrimdexFeedAssets} from "./BrimdexFeedAssets.sol";
import {IBrimdexFeedsSet} from "./IBrimdexFeedsSet.sol";

/// @title BrimdexFeedAgentPuller
/// @notice **One asset, one Somnia JSON API `createRequest` per `pull`.** There is no single agent call that
///         fetches all 16 DIA URLs: the platform runs one HTTP-style job per request, so sixteen symbols
///         require sixteen pullers (or sixteen sequential pulls), each paying its own deposit (~0.12 STT min).
/// @dev Fund **this** contract with native; only the bound coordinator may `pull`.
contract BrimdexFeedAgentPuller {
    IAgentRequester private constant PLATFORM =
        IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776);

    uint256 private constant JSON_API_AGENT_ID = 13174292974160097713;

    /// @notice Aligns with `PriceOracle` / Agent Monitor (per-request, not split across symbols).
    uint256 public constant MIN_AGENT_NATIVE_WEI = 120_000_000_000_000_000;

    IBrimdexFeedsSet public immutable feeds;
    uint8 public immutable assetId;
    address public immutable trustedBinder;

    address public coordinator;
    uint256 private _pendingRequestId;

    event CoordinatorBound(address indexed coordinator);
    event AgentRequestCreated(uint64 indexed tick, uint256 indexed requestId, uint8 indexed assetId, string diaKey);
    event AgentPriceReceived(uint256 indexed requestId, string diaKey, uint128 price, uint128 timestamp);
    event AgentRequestFailed(uint256 indexed requestId, string diaKey, ResponseStatus status);
    event AgentRequestSkipped(uint256 requiredWei, uint256 balance, uint8 reason);

    error Unauthorized();
    error OnlyPlatform();
    error UnknownAgentRequest();
    error BadConfig();
    error NativeSendFailed();

    event NativeWithdrawn(address indexed to, uint256 amount);

    constructor(address feeds_, uint8 assetId_, address trustedBinder_) {
        if (feeds_ == address(0) || trustedBinder_ == address(0)) revert BadConfig();
        if (assetId_ >= BrimdexFeedAssets.ASSET_COUNT) revert BadConfig();
        feeds = IBrimdexFeedsSet(feeds_);
        assetId = assetId_;
        trustedBinder = trustedBinder_;
    }

    receive() external payable {}

    function bindCoordinator(address coordinator_) external {
        if (msg.sender != trustedBinder) revert Unauthorized();
        if (coordinator != address(0) || coordinator_ == address(0)) revert BadConfig();
        coordinator = coordinator_;
        emit CoordinatorBound(coordinator_);
    }

    function pull(uint64 tick) external {
        if (msg.sender != coordinator) revert Unauthorized();

        uint256 per = singleRequestWei();
        uint256 bal = address(this).balance;
        if (bal < per) {
            emit AgentRequestSkipped(per, bal, 1);
            return;
        }
        if (_pendingRequestId != 0) {
            emit AgentRequestSkipped(per, bal, 2);
            return;
        }

        string memory url = BrimdexFeedAssets.feedUrl(assetId);
        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchUint.selector,
            url,
            string("Price"),
            uint8(8)
        );

        uint256 requestId = PLATFORM.createRequest{value: per}(
            JSON_API_AGENT_ID,
            address(this),
            this.handleResponse.selector,
            payload
        );

        _pendingRequestId = requestId;
        emit AgentRequestCreated(tick, requestId, assetId, BrimdexFeedAssets.diaKeyOf(assetId));
    }

    function handleResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external {
        if (msg.sender != address(PLATFORM)) revert OnlyPlatform();
        if (_pendingRequestId != requestId) revert UnknownAgentRequest();
        _pendingRequestId = 0;

        string memory diaKey = BrimdexFeedAssets.diaKeyOf(assetId);

        if (status == ResponseStatus.Success && responses.length > 0) {
            uint256 p = abi.decode(responses[0].result, (uint256));
            if (p > type(uint128).max) {
                emit AgentRequestFailed(requestId, diaKey, ResponseStatus.Failed);
                return;
            }
            uint128 ts = uint128(block.timestamp);
            feeds.setFromPuller(diaKey, uint128(p), ts);
            emit AgentPriceReceived(requestId, diaKey, uint128(p), ts);
        } else {
            emit AgentRequestFailed(requestId, diaKey, status);
        }
    }

    /// @notice `max(getRequestDeposit(), MIN_AGENT_NATIVE_WEI)` — forwarded in full on each `createRequest`.
    function singleRequestWei() public view returns (uint256) {
        uint256 d = PLATFORM.getRequestDeposit();
        return d > MIN_AGENT_NATIVE_WEI ? d : MIN_AGENT_NATIVE_WEI;
    }

    /// @notice Rescue native (STT). Only `trustedBinder` (same address as oracle `updater` at deploy).
    function withdrawNative(address payable to, uint256 amount) external {
        if (msg.sender != trustedBinder) revert Unauthorized();
        _withdrawNative(to, amount);
    }

    /// @notice Withdraw full native balance.
    function withdrawNativeAll(address payable to) external {
        if (msg.sender != trustedBinder) revert Unauthorized();
        _withdrawNative(to, address(this).balance);
    }

    function _withdrawNative(address payable to, uint256 amount) private {
        if (to == address(0)) revert BadConfig();
        if (amount > address(this).balance) revert BadConfig();
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert NativeSendFailed();
        emit NativeWithdrawn(to, amount);
    }
}
