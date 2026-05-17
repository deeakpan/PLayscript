// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAgentRequester, IJsonApiAgent, Request, Response, ResponseStatus} from "./interfaces/ISomniaAgents.sol";

/// @title PriceOracle
/// @notice Fetches live cryptocurrency prices using the JSON API Request agent
/// @dev `createRequest` + platform address aligned with Somnia Agent Monitor (see `ISomniaAgents`).

contract PriceOracle {
    IAgentRequester public constant PLATFORM =
        IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776);

    uint256 public constant JSON_API_AGENT_ID = 13174292974160097713;

    /// @notice Minimum native forwarded with each `createRequest` (0.12 STT). Somnia Agent Monitor bills JSON API
    ///         ~0.12 for 3 runners while `getRequestDeposit()` can read lower on-chain — use the higher value.
    uint256 public constant MIN_AGENT_NATIVE_WEI = 120_000_000_000_000_000;

    uint256 public latestPrice;
    uint256 public lastUpdatedAt;
    mapping(uint256 => bool) public pendingRequests;

    event PriceRequested(uint256 indexed requestId, string url, string selector);
    event PriceReceived(uint256 indexed requestId, uint256 price);
    event RequestFailed(uint256 indexed requestId, ResponseStatus status);

    function requestBtcPrice() external payable returns (uint256 requestId) {
        return _requestPrice(
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
            "bitcoin.usd"
        );
    }

    function requestEthPrice() external payable returns (uint256 requestId) {
        return _requestPrice(
            "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
            "ethereum.usd"
        );
    }

    /// @notice Same DIA HTTP source as `BrimdexFeeds` BTC (`assetId` 0): JSON field `Price`, scaled to 8 decimals by the agent.
    function requestDiaBtcUsd() external payable returns (uint256 requestId) {
        return _requestPrice(
            "https://api.diadata.org/v1/assetQuotation/Bitcoin/0x0000000000000000000000000000000000000000",
            "Price"
        );
    }

    function requestPrice(string calldata coinId) external payable returns (uint256 requestId) {
        string memory url = string.concat(
            "https://api.coingecko.com/api/v3/simple/price?ids=",
            coinId,
            "&vs_currencies=usd"
        );
        string memory selector = string.concat(coinId, ".usd");

        return _requestPrice(url, selector);
    }

    function _requestPrice(string memory url, string memory selector) internal returns (uint256 requestId) {
        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchUint.selector,
            url,
            selector,
            uint8(8)
        );

        uint256 platformDeposit = PLATFORM.getRequestDeposit();
        uint256 valueToSend = platformDeposit > MIN_AGENT_NATIVE_WEI ? platformDeposit : MIN_AGENT_NATIVE_WEI;
        require(msg.value >= valueToSend, "Insufficient deposit");

        requestId = PLATFORM.createRequest{value: valueToSend}(
            JSON_API_AGENT_ID,
            address(this),
            this.handleResponse.selector,
            payload
        );

        pendingRequests[requestId] = true;
        emit PriceRequested(requestId, url, selector);

        if (msg.value > valueToSend) {
            payable(msg.sender).transfer(msg.value - valueToSend);
        }
    }

    function handleResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external {
        require(msg.sender == address(PLATFORM), "Only platform");
        require(pendingRequests[requestId], "Unknown request");

        delete pendingRequests[requestId];

        if (status == ResponseStatus.Success && responses.length > 0) {
            latestPrice = abi.decode(responses[0].result, (uint256));
            lastUpdatedAt = block.timestamp;
            emit PriceReceived(requestId, latestPrice);
        } else {
            emit RequestFailed(requestId, status);
        }
    }

    function getFormattedPrice() external view returns (uint256 wholePart, uint256 decimalPart) {
        wholePart = latestPrice / 1e8;
        decimalPart = latestPrice % 1e8;
    }

    function getRequiredDeposit() external view returns (uint256) {
        uint256 d = PLATFORM.getRequestDeposit();
        return d > MIN_AGENT_NATIVE_WEI ? d : MIN_AGENT_NATIVE_WEI;
    }

    receive() external payable {}
}
