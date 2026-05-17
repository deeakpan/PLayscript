// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAgentRequester, IJsonApiAgent, Request, Response, ResponseStatus} from "../interfaces/ISomniaAgents.sol";

/// @title EspnJsonApiFetchMocks
/// @notice Somnia JSON API agent probes — paths from `espn-api-offchain-verify.mjs` / `lib/espn-mock-hardcoded.generated.json`.
/// @dev Past fixtures: EPL 740902, NBA 400878160, NFL 401671764, MLB 401695561.
contract EspnJsonApiFetchMocks {
    IAgentRequester public constant PLATFORM =
        IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776);

    uint256 public constant JSON_API_AGENT_ID = 13174292974160097713;

    // ─── URLs (hardcoded sample events) ───

    string public constant SOCCER_EPL_SUMMARY_URL =
        "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/summary?event=740902";

    string public constant SOCCER_EPL_SCOREBOARD_URL =
        "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard/740902";

    string public constant NBA_SCOREBOARD_URL =
        "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard/400878160";

    string public constant NFL_SCOREBOARD_URL =
        "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard/401671764";

    string public constant MLB_SCOREBOARD_URL =
        "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard/401695561";

    // Scoreboard (all sports)
    string private constant SEL_SB_HOME = "competitions[0].competitors[0].score";
    string private constant SEL_SB_AWAY = "competitions[0].competitors[1].score";

    // Soccer summary — header halves (740902 verified)
    string private constant SEL_HDR_HT_HOME = "header.competitions[0].competitors[0].linescores[0].displayValue";
    string private constant SEL_HDR_HT_AWAY = "header.competitions[0].competitors[1].linescores[0].displayValue";

    // Soccer summary — team card totals (740902 indices)
    string private constant SEL_SUM_HOME_YELLOW = "boxscore.teams[0].statistics[1].displayValue";
    string private constant SEL_SUM_AWAY_YELLOW = "boxscore.teams[1].statistics[1].displayValue";
    string private constant SEL_SUM_HOME_RED = "boxscore.teams[0].statistics[2].displayValue";
    string private constant SEL_SUM_AWAY_RED = "boxscore.teams[1].statistics[2].displayValue";

    // NBA/NFL quarters on scoreboard competitors
    string private constant SEL_HOME_Q1 = "competitions[0].competitors[0].linescores[0].displayValue";
    string private constant SEL_HOME_Q2 = "competitions[0].competitors[0].linescores[1].displayValue";
    string private constant SEL_AWAY_Q1 = "competitions[0].competitors[1].linescores[0].displayValue";
    string private constant SEL_AWAY_Q2 = "competitions[0].competitors[1].linescores[1].displayValue";

    uint8 private constant UINT_DEC = 0;

    // field id → storage (see `_storeUint`)
    uint16 private constant F_SOCCER_SB_HOME = 1;
    uint16 private constant F_SOCCER_SB_AWAY = 2;
    uint16 private constant F_SOCCER_HT_HOME = 3;
    uint16 private constant F_SOCCER_HT_AWAY = 4;
    uint16 private constant F_SOCCER_YELLOW_HOME = 5;
    uint16 private constant F_SOCCER_YELLOW_AWAY = 6;
    uint16 private constant F_SOCCER_RED_HOME = 7;
    uint16 private constant F_SOCCER_RED_AWAY = 8;

    uint16 private constant F_NBA_HOME = 10;
    uint16 private constant F_NBA_AWAY = 11;
    uint16 private constant F_NBA_HOME_Q1 = 12;
    uint16 private constant F_NBA_HOME_Q2 = 13;
    uint16 private constant F_NBA_AWAY_Q1 = 14;
    uint16 private constant F_NBA_AWAY_Q2 = 15;

    uint16 private constant F_NFL_HOME = 20;
    uint16 private constant F_NFL_AWAY = 21;
    uint16 private constant F_NFL_HOME_Q1 = 22;
    uint16 private constant F_NFL_HOME_Q2 = 23;
    uint16 private constant F_NFL_AWAY_Q1 = 24;
    uint16 private constant F_NFL_AWAY_Q2 = 25;

    uint16 private constant F_MLB_HOME = 30;
    uint16 private constant F_MLB_AWAY = 31;

    mapping(uint256 => uint16) public pendingField;

    // Soccer EPL stored results
    uint256 public soccerFinalHome;
    uint256 public soccerFinalAway;
    uint256 public soccerHtHome;
    uint256 public soccerHtAway;
    uint256 public soccerYellowHome;
    uint256 public soccerYellowAway;
    uint256 public soccerRedHome;
    uint256 public soccerRedAway;

    // NBA
    uint256 public nbaFinalHome;
    uint256 public nbaFinalAway;
    uint256 public nbaHomeQ1;
    uint256 public nbaHomeQ2;
    uint256 public nbaAwayQ1;
    uint256 public nbaAwayQ2;

    // NFL
    uint256 public nflFinalHome;
    uint256 public nflFinalAway;
    uint256 public nflHomeQ1;
    uint256 public nflHomeQ2;
    uint256 public nflAwayQ1;
    uint256 public nflAwayQ2;

    // MLB
    uint256 public mlbFinalHome;
    uint256 public mlbFinalAway;

    event EspnRequested(uint256 indexed requestId, uint16 indexed field);
    event EspnUintReceived(uint16 indexed field, uint256 value);
    event EspnFailed(uint256 indexed requestId, uint16 field, ResponseStatus status);

    function getRequiredDeposit() public view returns (uint256) {
        return _agentDeposit();
    }

    function soccerEplProbeCallCount() public pure returns (uint256) {
        return 8;
    }

    function nbaProbeCallCount() public pure returns (uint256) {
        return 6;
    }

    function nflProbeCallCount() public pure returns (uint256) {
        return 6;
    }

    function mlbProbeCallCount() public pure returns (uint256) {
        return 2;
    }

    /// @notice One tx → 8 agent requests for EPL 740902 (final, HT, Y/R). Pay `getRequiredDeposit() * 8`.
    function requestSoccerEplProbeBundle() external payable returns (uint256 firstRequestId) {
        uint256 dep = _agentDeposit();
        uint256 n = soccerEplProbeCallCount();
        require(msg.value >= dep * n, "EspnJsonApiFetchMocks: need 8x deposit");
        firstRequestId = _requestUint(SOCCER_EPL_SCOREBOARD_URL, SEL_SB_HOME, F_SOCCER_SB_HOME, dep);
        _requestUint(SOCCER_EPL_SCOREBOARD_URL, SEL_SB_AWAY, F_SOCCER_SB_AWAY, dep);
        _requestUint(SOCCER_EPL_SUMMARY_URL, SEL_HDR_HT_HOME, F_SOCCER_HT_HOME, dep);
        _requestUint(SOCCER_EPL_SUMMARY_URL, SEL_HDR_HT_AWAY, F_SOCCER_HT_AWAY, dep);
        _requestUint(SOCCER_EPL_SUMMARY_URL, SEL_SUM_HOME_YELLOW, F_SOCCER_YELLOW_HOME, dep);
        _requestUint(SOCCER_EPL_SUMMARY_URL, SEL_SUM_AWAY_YELLOW, F_SOCCER_YELLOW_AWAY, dep);
        _requestUint(SOCCER_EPL_SUMMARY_URL, SEL_SUM_HOME_RED, F_SOCCER_RED_HOME, dep);
        _requestUint(SOCCER_EPL_SUMMARY_URL, SEL_SUM_AWAY_RED, F_SOCCER_RED_AWAY, dep);
        _refundExcess(msg.value, dep * n);
    }

    /// @notice NBA 400878160 — final + Q1/Q2 per team (6 calls).
    function requestNbaProbeBundle() external payable {
        uint256 dep = _agentDeposit();
        uint256 n = nbaProbeCallCount();
        require(msg.value >= dep * n, "EspnJsonApiFetchMocks: need 6x deposit");
        _requestUint(NBA_SCOREBOARD_URL, SEL_SB_HOME, F_NBA_HOME, dep);
        _requestUint(NBA_SCOREBOARD_URL, SEL_SB_AWAY, F_NBA_AWAY, dep);
        _requestUint(NBA_SCOREBOARD_URL, SEL_HOME_Q1, F_NBA_HOME_Q1, dep);
        _requestUint(NBA_SCOREBOARD_URL, SEL_HOME_Q2, F_NBA_HOME_Q2, dep);
        _requestUint(NBA_SCOREBOARD_URL, SEL_AWAY_Q1, F_NBA_AWAY_Q1, dep);
        _requestUint(NBA_SCOREBOARD_URL, SEL_AWAY_Q2, F_NBA_AWAY_Q2, dep);
        _refundExcess(msg.value, dep * n);
    }

    /// @notice NFL 401671764 — final + Q1/Q2 per team (6 calls).
    function requestNflProbeBundle() external payable {
        uint256 dep = _agentDeposit();
        uint256 n = nflProbeCallCount();
        require(msg.value >= dep * n, "EspnJsonApiFetchMocks: need 6x deposit");
        _requestUint(NFL_SCOREBOARD_URL, SEL_SB_HOME, F_NFL_HOME, dep);
        _requestUint(NFL_SCOREBOARD_URL, SEL_SB_AWAY, F_NFL_AWAY, dep);
        _requestUint(NFL_SCOREBOARD_URL, SEL_HOME_Q1, F_NFL_HOME_Q1, dep);
        _requestUint(NFL_SCOREBOARD_URL, SEL_HOME_Q2, F_NFL_HOME_Q2, dep);
        _requestUint(NFL_SCOREBOARD_URL, SEL_AWAY_Q1, F_NFL_AWAY_Q1, dep);
        _requestUint(NFL_SCOREBOARD_URL, SEL_AWAY_Q2, F_NFL_AWAY_Q2, dep);
        _refundExcess(msg.value, dep * n);
    }

    /// @notice MLB 401695561 — final only (2 calls).
    function requestMlbProbeBundle() external payable {
        uint256 dep = _agentDeposit();
        uint256 n = mlbProbeCallCount();
        require(msg.value >= dep * n, "EspnJsonApiFetchMocks: need 2x deposit");
        _requestUint(MLB_SCOREBOARD_URL, SEL_SB_HOME, F_MLB_HOME, dep);
        _requestUint(MLB_SCOREBOARD_URL, SEL_SB_AWAY, F_MLB_AWAY, dep);
        _refundExcess(msg.value, dep * n);
    }

    function handleEspnResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external {
        require(msg.sender == address(PLATFORM), "EspnJsonApiFetchMocks: only platform");
        uint16 fid = pendingField[requestId];
        require(fid != 0, "EspnJsonApiFetchMocks: unknown request");
        delete pendingField[requestId];

        if (status != ResponseStatus.Success || responses.length == 0) {
            emit EspnFailed(requestId, fid, status);
            return;
        }

        uint256 v = abi.decode(responses[0].result, (uint256));
        _storeUint(fid, v);
        emit EspnUintReceived(fid, v);
    }

    function _storeUint(uint16 fid, uint256 v) private {
        if (fid == F_SOCCER_SB_HOME) soccerFinalHome = v;
        else if (fid == F_SOCCER_SB_AWAY) soccerFinalAway = v;
        else if (fid == F_SOCCER_HT_HOME) soccerHtHome = v;
        else if (fid == F_SOCCER_HT_AWAY) soccerHtAway = v;
        else if (fid == F_SOCCER_YELLOW_HOME) soccerYellowHome = v;
        else if (fid == F_SOCCER_YELLOW_AWAY) soccerYellowAway = v;
        else if (fid == F_SOCCER_RED_HOME) soccerRedHome = v;
        else if (fid == F_SOCCER_RED_AWAY) soccerRedAway = v;
        else if (fid == F_NBA_HOME) nbaFinalHome = v;
        else if (fid == F_NBA_AWAY) nbaFinalAway = v;
        else if (fid == F_NBA_HOME_Q1) nbaHomeQ1 = v;
        else if (fid == F_NBA_HOME_Q2) nbaHomeQ2 = v;
        else if (fid == F_NBA_AWAY_Q1) nbaAwayQ1 = v;
        else if (fid == F_NBA_AWAY_Q2) nbaAwayQ2 = v;
        else if (fid == F_NFL_HOME) nflFinalHome = v;
        else if (fid == F_NFL_AWAY) nflFinalAway = v;
        else if (fid == F_NFL_HOME_Q1) nflHomeQ1 = v;
        else if (fid == F_NFL_HOME_Q2) nflHomeQ2 = v;
        else if (fid == F_NFL_AWAY_Q1) nflAwayQ1 = v;
        else if (fid == F_NFL_AWAY_Q2) nflAwayQ2 = v;
        else if (fid == F_MLB_HOME) mlbFinalHome = v;
        else if (fid == F_MLB_AWAY) mlbFinalAway = v;
        else revert("EspnJsonApiFetchMocks: bad field");
    }

    function _requestUint(string memory url, string memory sel, uint16 field, uint256 dep)
        private
        returns (uint256 requestId)
    {
        bytes memory payload = abi.encodeWithSelector(IJsonApiAgent.fetchUint.selector, url, sel, UINT_DEC);
        requestId = PLATFORM.createRequest{value: dep}(
            JSON_API_AGENT_ID, address(this), this.handleEspnResponse.selector, payload
        );
        pendingField[requestId] = field;
        emit EspnRequested(requestId, field);
    }

    function _agentDeposit() private view returns (uint256) {
        uint256 d = PLATFORM.getRequestDeposit();
        uint256 minWei = 0.12 ether;
        return d > minWei ? d : minWei;
    }

    function _refundExcess(uint256 sent, uint256 used) private {
        if (sent > used) {
            payable(msg.sender).transfer(sent - used);
        }
    }

    receive() external payable {}
}
