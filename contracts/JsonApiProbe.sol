// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAgentRequester, IJsonApiAgent, Request, Response, ResponseStatus} from "./interfaces/ISomniaAgents.sol";

/// @title JsonApiProbe
/// @notice Minimal test harness for Somnia JSON API Request agent: `fetchUint`, `fetchString`, `fetchInt`.
/// @dev Platform address matches Somnia Agent Monitor (`createRequest` selector `0x8bbcbbe2`).
contract JsonApiProbe {
    IAgentRequester public constant PLATFORM =
        IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776);

    uint256 public constant JSON_API_AGENT_ID = 13174292974160097713;

    // Demo endpoints (public JSON, no auth)
    string public constant DEMO_UINT_URL = "https://jsonplaceholder.typicode.com/users/1";
    string public constant DEMO_UINT_SELECTOR = "id";

    string public constant DEMO_STRING_URL = "https://jsonplaceholder.typicode.com/users/1";
    string public constant DEMO_STRING_SELECTOR = "name";

    string public constant DEMO_INT_URL =
        "https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m";
    string public constant DEMO_INT_SELECTOR = "current.temperature_2m";

    /// @notice TheSportsDB — last events for team id 133602 (Liverpool), free API key `3` in path
    string public constant DEMO_THE_SPORTS_URL =
        "https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=133602";

    string public constant DEMO_THE_SPORTS_SEL_HOME_SCORE = "results[0].intHomeScore";
    string public constant DEMO_THE_SPORTS_SEL_AWAY_SCORE = "results[0].intAwayScore";
    string public constant DEMO_THE_SPORTS_SEL_HOME_TEAM = "results[0].strHomeTeam";
    string public constant DEMO_THE_SPORTS_SEL_AWAY_TEAM = "results[0].strAwayTeam";
    string public constant DEMO_THE_SPORTS_SEL_STATUS = "results[0].strStatus";
    string public constant DEMO_THE_SPORTS_SEL_EVENT = "results[0].strEvent";
    string public constant DEMO_THE_SPORTS_SEL_LEAGUE = "results[0].strLeague";
    string public constant DEMO_THE_SPORTS_SEL_DATE_EVENT = "results[0].dateEvent";

    /// @dev Field id 1..8 for TheSportsDB demo; bitmask `demoTheSportsReceivedMask` tracks completions
    mapping(uint256 => uint8) public pendingTheSportsField;

    uint256 public demoTheSportsHomeScore;
    uint256 public demoTheSportsAwayScore;
    string public demoTheSportsHomeTeam;
    string public demoTheSportsAwayTeam;
    string public demoTheSportsStatus;
    string public demoTheSportsEventName;
    string public demoTheSportsLeague;
    string public demoTheSportsDateEvent;
    /// @dev Bits 0..7 set when fields 1..8 are received (OR together)
    uint256 public demoTheSportsReceivedMask;

    mapping(uint256 => bool) public pendingUint;
    mapping(uint256 => bool) public pendingString;
    mapping(uint256 => bool) public pendingInt;

    uint256 public lastUintResult;
    string public lastStringResult;
    int256 public lastIntResult;

    event UintRequested(uint256 indexed requestId);
    event UintReceived(uint256 indexed requestId, uint256 value);
    event StringRequested(uint256 indexed requestId);
    event StringReceived(uint256 indexed requestId, string value);
    event IntRequested(uint256 indexed requestId);
    event IntReceived(uint256 indexed requestId, int256 value);
    event RequestNotSuccess(uint256 indexed requestId, ResponseStatus status);

    event TheSportsDemoRequested(uint256 indexed requestId, uint8 indexed field);
    event TheSportsDemoUintReceived(uint8 indexed field, uint256 value);
    event TheSportsDemoStringReceived(uint8 indexed field, string value);
    event TheSportsDemoRequestFailed(uint256 indexed requestId, uint8 field, ResponseStatus status);

    function getRequiredDeposit() external view returns (uint256) {
        return PLATFORM.getRequestDeposit();
    }

    function requestDemoUint() external payable returns (uint256 requestId) {
        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchUint.selector,
            DEMO_UINT_URL,
            DEMO_UINT_SELECTOR,
            uint8(0)
        );
        requestId = _create(JSON_API_AGENT_ID, this.handleUintResponse.selector, payload);
        pendingUint[requestId] = true;
        emit UintRequested(requestId);
        _refundExcess();
    }

    function requestDemoString() external payable returns (uint256 requestId) {
        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchString.selector,
            DEMO_STRING_URL,
            DEMO_STRING_SELECTOR
        );
        requestId = _create(JSON_API_AGENT_ID, this.handleStringResponse.selector, payload);
        pendingString[requestId] = true;
        emit StringRequested(requestId);
        _refundExcess();
    }

    function requestDemoInt() external payable returns (uint256 requestId) {
        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchInt.selector,
            DEMO_INT_URL,
            DEMO_INT_SELECTOR,
            uint8(1)
        );
        requestId = _create(JSON_API_AGENT_ID, this.handleIntResponse.selector, payload);
        pendingInt[requestId] = true;
        emit IntRequested(requestId);
        _refundExcess();
    }

    // ─── TheSportsDB demo (same JSON API agent) — fetchUint / fetchString ───

    function requestDemoTheSportsHomeScore() external payable returns (uint256 requestId) {
        requestId = _theSportsRequestUint(1, DEMO_THE_SPORTS_SEL_HOME_SCORE, 0);
    }

    function requestDemoTheSportsAwayScore() external payable returns (uint256 requestId) {
        requestId = _theSportsRequestUint(2, DEMO_THE_SPORTS_SEL_AWAY_SCORE, 0);
    }

    function requestDemoTheSportsHomeTeam() external payable returns (uint256 requestId) {
        requestId = _theSportsRequestString(3, DEMO_THE_SPORTS_SEL_HOME_TEAM);
    }

    function requestDemoTheSportsAwayTeam() external payable returns (uint256 requestId) {
        requestId = _theSportsRequestString(4, DEMO_THE_SPORTS_SEL_AWAY_TEAM);
    }

    function requestDemoTheSportsStatus() external payable returns (uint256 requestId) {
        requestId = _theSportsRequestString(5, DEMO_THE_SPORTS_SEL_STATUS);
    }

    function requestDemoTheSportsEvent() external payable returns (uint256 requestId) {
        requestId = _theSportsRequestString(6, DEMO_THE_SPORTS_SEL_EVENT);
    }

    function requestDemoTheSportsLeague() external payable returns (uint256 requestId) {
        requestId = _theSportsRequestString(7, DEMO_THE_SPORTS_SEL_LEAGUE);
    }

    function requestDemoTheSportsDateEvent() external payable returns (uint256 requestId) {
        requestId = _theSportsRequestString(8, DEMO_THE_SPORTS_SEL_DATE_EVENT);
    }

    function _theSportsMask(uint8 field) private pure returns (uint256) {
        return uint256(1) << (field - 1);
    }

    function _theSportsRequestUint(uint8 field, string memory selector, uint8 decimals)
        private
        returns (uint256 requestId)
    {
        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchUint.selector,
            DEMO_THE_SPORTS_URL,
            selector,
            decimals
        );
        requestId = _create(JSON_API_AGENT_ID, this.handleTheSportsDbResponse.selector, payload);
        pendingTheSportsField[requestId] = field;
        emit TheSportsDemoRequested(requestId, field);
        _refundExcess();
    }

    function _theSportsRequestString(uint8 field, string memory selector) private returns (uint256 requestId) {
        bytes memory payload =
            abi.encodeWithSelector(IJsonApiAgent.fetchString.selector, DEMO_THE_SPORTS_URL, selector);
        requestId = _create(JSON_API_AGENT_ID, this.handleTheSportsDbResponse.selector, payload);
        pendingTheSportsField[requestId] = field;
        emit TheSportsDemoRequested(requestId, field);
        _refundExcess();
    }

    function handleTheSportsDbResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external {
        require(msg.sender == address(PLATFORM), "JsonApiProbe: only platform");
        uint8 field = pendingTheSportsField[requestId];
        require(field != 0, "JsonApiProbe: unknown thesports request");
        delete pendingTheSportsField[requestId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            emit TheSportsDemoRequestFailed(requestId, field, status);
            return;
        }

        if (field == 1) {
            demoTheSportsHomeScore = abi.decode(responses[0].result, (uint256));
            demoTheSportsReceivedMask |= _theSportsMask(1);
            emit TheSportsDemoUintReceived(1, demoTheSportsHomeScore);
        } else if (field == 2) {
            demoTheSportsAwayScore = abi.decode(responses[0].result, (uint256));
            demoTheSportsReceivedMask |= _theSportsMask(2);
            emit TheSportsDemoUintReceived(2, demoTheSportsAwayScore);
        } else if (field == 3) {
            demoTheSportsHomeTeam = abi.decode(responses[0].result, (string));
            demoTheSportsReceivedMask |= _theSportsMask(3);
            emit TheSportsDemoStringReceived(3, demoTheSportsHomeTeam);
        } else if (field == 4) {
            demoTheSportsAwayTeam = abi.decode(responses[0].result, (string));
            demoTheSportsReceivedMask |= _theSportsMask(4);
            emit TheSportsDemoStringReceived(4, demoTheSportsAwayTeam);
        } else if (field == 5) {
            demoTheSportsStatus = abi.decode(responses[0].result, (string));
            demoTheSportsReceivedMask |= _theSportsMask(5);
            emit TheSportsDemoStringReceived(5, demoTheSportsStatus);
        } else if (field == 6) {
            demoTheSportsEventName = abi.decode(responses[0].result, (string));
            demoTheSportsReceivedMask |= _theSportsMask(6);
            emit TheSportsDemoStringReceived(6, demoTheSportsEventName);
        } else if (field == 7) {
            demoTheSportsLeague = abi.decode(responses[0].result, (string));
            demoTheSportsReceivedMask |= _theSportsMask(7);
            emit TheSportsDemoStringReceived(7, demoTheSportsLeague);
        } else if (field == 8) {
            demoTheSportsDateEvent = abi.decode(responses[0].result, (string));
            demoTheSportsReceivedMask |= _theSportsMask(8);
            emit TheSportsDemoStringReceived(8, demoTheSportsDateEvent);
        }
    }

    function _create(uint256 agentId, bytes4 callbackSelector, bytes memory payload)
        private
        returns (uint256 requestId)
    {
        uint256 deposit = PLATFORM.getRequestDeposit();
        require(msg.value >= deposit, "JsonApiProbe: insufficient deposit");
        requestId = PLATFORM.createRequest{value: deposit}(agentId, address(this), callbackSelector, payload);
    }

    function _refundExcess() private {
        uint256 deposit = PLATFORM.getRequestDeposit();
        if (msg.value > deposit) {
            payable(msg.sender).transfer(msg.value - deposit);
        }
    }

    function handleUintResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external {
        require(msg.sender == address(PLATFORM), "JsonApiProbe: only platform");
        require(pendingUint[requestId], "JsonApiProbe: unknown uint request");
        delete pendingUint[requestId];

        if (status == ResponseStatus.Success && responses.length > 0) {
            lastUintResult = abi.decode(responses[0].result, (uint256));
            emit UintReceived(requestId, lastUintResult);
        } else {
            emit RequestNotSuccess(requestId, status);
        }
    }

    function handleStringResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external {
        require(msg.sender == address(PLATFORM), "JsonApiProbe: only platform");
        require(pendingString[requestId], "JsonApiProbe: unknown string request");
        delete pendingString[requestId];

        if (status == ResponseStatus.Success && responses.length > 0) {
            lastStringResult = abi.decode(responses[0].result, (string));
            emit StringReceived(requestId, lastStringResult);
        } else {
            emit RequestNotSuccess(requestId, status);
        }
    }

    function handleIntResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external {
        require(msg.sender == address(PLATFORM), "JsonApiProbe: only platform");
        require(pendingInt[requestId], "JsonApiProbe: unknown int request");
        delete pendingInt[requestId];

        if (status == ResponseStatus.Success && responses.length > 0) {
            lastIntResult = abi.decode(responses[0].result, (int256));
            emit IntReceived(requestId, lastIntResult);
        } else {
            emit RequestNotSuccess(requestId, status);
        }
    }

    receive() external payable {}
}
