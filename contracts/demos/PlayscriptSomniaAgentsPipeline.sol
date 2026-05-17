// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAgentRequester, IJsonApiAgent, ILLMAgent, IParseWebsiteAgent, Request, Response, ResponseStatus} from "../interfaces/ISomniaAgents.sol";

/// @title PlayscriptSomniaAgentsPipeline
/// @notice Sequential orchestration of Somnia’s three agent surfaces on one chain: JSON API Request →
///         LLM Inference (`inferString` with a closed vocabulary) → LLM Parse Website (`ExtractString`).
/// @dev Fixed TheSportsDB sources for Liverpool fixtures (`eventslast` + team page). Each `startPipeline`
///      forwards three per-request native payments (`max(getRequestDeposit(), MIN_NATIVE_WEI)` each).
contract PlayscriptSomniaAgentsPipeline {
    IAgentRequester private constant PLATFORM =
        IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776);

    uint256 private constant JSON_API_AGENT_ID = 13174292974160097713;
    uint256 private constant LLM_AGENT_ID = 12847293847561029384;
    uint256 private constant PARSE_WEBSITE_AGENT_ID = 12875401142070969085;

    uint256 public constant MIN_NATIVE_WEI = 120_000_000_000_000_000;

    enum Phase {
        Idle,
        JsonPending,
        LlmPending,
        ParsePending,
        Succeeded,
        Failed
    }

    Phase public phase;
    uint256 private _pendingJson;
    uint256 private _pendingLlm;
    uint256 private _pendingParse;

    string public lastEventTitle;
    string public lastSportBucket;
    string public lastTeamPageExtract;
    uint64 public successfulRunCount;

    string public constant EVENTS_LAST_URL =
        "https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=133602";
    string public constant EVENT_TITLE_SELECTOR = "results[0].strEvent";
    string public constant TEAM_PAGE_URL = "https://www.thesportsdb.com/team/133602";

    event PipelineStarted(address indexed caller, uint256 indexed jsonRequestId);
    event JsonResolved(string eventTitle, uint256 indexed llmRequestId);
    event LlmResolved(string sportBucket, uint256 indexed parseRequestId);
    event ParseResolved(string extracted);
    event PipelineSucceeded(uint64 indexed runIndex);
    event PipelineStepFailed(Phase indexed failedAt, ResponseStatus status);

    error OnlyPlatform();
    error InvalidState();
    error InsufficientBalance();

    receive() external payable {}

    /// @notice Total native required for one full pipeline (three `createRequest` deposits).
    function requiredNativeTotal() public view returns (uint256) {
        return 3 * _perRequestWei();
    }

    function _perRequestWei() private view returns (uint256) {
        uint256 d = PLATFORM.getRequestDeposit();
        return d > MIN_NATIVE_WEI ? d : MIN_NATIVE_WEI;
    }

    /// @notice Begins JSON → LLM → parse chain. Contract balance after call must hold `requiredNativeTotal()`.
    function startPipeline() external payable {
        if (phase != Phase.Idle && phase != Phase.Succeeded && phase != Phase.Failed) revert InvalidState();

        uint256 per = _perRequestWei();
        uint256 need = 3 * per;
        uint256 total = address(this).balance;
        if (total < need) revert InsufficientBalance();
        if (total > need) {
            payable(msg.sender).transfer(total - need);
        }

        lastEventTitle = "";
        lastSportBucket = "";
        lastTeamPageExtract = "";

        phase = Phase.JsonPending;

        bytes memory payload = abi.encodeWithSelector(
            IJsonApiAgent.fetchString.selector,
            EVENTS_LAST_URL,
            EVENT_TITLE_SELECTOR
        );

        uint256 rid = PLATFORM.createRequest{value: per}(JSON_API_AGENT_ID, address(this), this.onJsonDone.selector, payload);
        _pendingJson = rid;
        emit PipelineStarted(msg.sender, rid);
    }

    /// @notice Returns orchestrator to `Idle` after a terminal outcome so a new `startPipeline` is explicit.
    function reset() external {
        if (phase != Phase.Succeeded && phase != Phase.Failed) revert InvalidState();
        phase = Phase.Idle;
        _pendingJson = 0;
        _pendingLlm = 0;
        _pendingParse = 0;
    }

    function onJsonDone(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external {
        if (msg.sender != address(PLATFORM)) revert OnlyPlatform();
        if (phase != Phase.JsonPending || requestId != _pendingJson) revert InvalidState();

        if (status != ResponseStatus.Success || responses.length == 0) {
            phase = Phase.Failed;
            emit PipelineStepFailed(Phase.JsonPending, status);
            return;
        }

        string memory title = abi.decode(responses[0].result, (string));
        lastEventTitle = title;

        uint256 per = _perRequestWei();
        string memory safe = _truncate(title, 400);

        string[] memory allowed = new string[](2);
        allowed[0] = "SOCCER";
        allowed[1] = "OTHER";

        string memory prompt = string.concat(
            "You label sports fixture titles. Given ONLY this line, is the fixture clearly association football ",
            "(soccer / Premier League / UCL / domestic league football wording)? ",
            "Reply with exactly SOCCER or OTHER. Title: \"",
            safe,
            "\""
        );

        bytes memory payload = abi.encodeWithSelector(
            ILLMAgent.inferString.selector,
            prompt,
            "You output exactly one allowed token, no punctuation.",
            false,
            allowed
        );

        phase = Phase.LlmPending;
        uint256 rid = PLATFORM.createRequest{value: per}(LLM_AGENT_ID, address(this), this.onLlmDone.selector, payload);
        _pendingLlm = rid;
        emit JsonResolved(title, rid);
    }

    function onLlmDone(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external {
        if (msg.sender != address(PLATFORM)) revert OnlyPlatform();
        if (phase != Phase.LlmPending || requestId != _pendingLlm) revert InvalidState();

        if (status != ResponseStatus.Success || responses.length == 0) {
            phase = Phase.Failed;
            emit PipelineStepFailed(Phase.LlmPending, status);
            return;
        }

        string memory bucket = abi.decode(responses[0].result, (string));
        lastSportBucket = bucket;

        uint256 per = _perRequestWei();
        string[] memory options = new string[](0);

        bytes memory payload = abi.encodeWithSelector(
            IParseWebsiteAgent.ExtractString.selector,
            "team_label",
            "Short official-style club name from TheSportsDB team page",
            options,
            string.concat(
                "From this TheSportsDB team page, return the club short name (strTeam style) shown for Liverpool FC. ",
                "Context from API title: ",
                _truncate(lastEventTitle, 200)
            ),
            TEAM_PAGE_URL,
            false,
            uint8(2)
        );

        phase = Phase.ParsePending;
        uint256 rid =
            PLATFORM.createRequest{value: per}(PARSE_WEBSITE_AGENT_ID, address(this), this.onParseDone.selector, payload);
        _pendingParse = rid;
        emit LlmResolved(bucket, rid);
    }

    function onParseDone(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external {
        if (msg.sender != address(PLATFORM)) revert OnlyPlatform();
        if (phase != Phase.ParsePending || requestId != _pendingParse) revert InvalidState();

        if (status != ResponseStatus.Success || responses.length == 0) {
            phase = Phase.Failed;
            emit PipelineStepFailed(Phase.ParsePending, status);
            return;
        }

        string memory extracted = abi.decode(responses[0].result, (string));
        lastTeamPageExtract = extracted;
        phase = Phase.Succeeded;
        unchecked {
            ++successfulRunCount;
        }
        emit ParseResolved(extracted);
        emit PipelineSucceeded(successfulRunCount);
    }

    function _truncate(string memory s, uint256 maxLen) private pure returns (string memory) {
        bytes memory b = bytes(s);
        if (b.length <= maxLen) return s;
        bytes memory out = new bytes(maxLen);
        for (uint256 i; i < maxLen; ++i) {
            out[i] = b[i];
        }
        return string(out);
    }
}
