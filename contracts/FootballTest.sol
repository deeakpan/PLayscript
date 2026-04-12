// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAgentRequester, IJsonApiAgent, Request, Response, ResponseStatus} from "./interfaces/ISomniaAgents.sol";

/// @title FootballTest
/// @notice Minimal Playscript-style test: register TheSportsDB URL + JSON selectors, then `lockScript`
///         kicks off 5 chained JSON API agent fetches (home/away score, status, home/away team).
///         When all succeed, grades soccer slots vs your picks and emits payout in **$PLAY units** (no mint / no ERC20).
/// @dev Agent flow matches `JsonApiProbe` TheSports demo: all **five** `createRequest` calls happen in **`lockScript`**
///      (same EOA tx), like submitting eight probe txs — Somnia reliably delivers callbacks for those. We do **not**
///      chain `createRequest` from inside `handleFootballFetch` (callback re-entrancy is unreliable vs probe).
///      `msg.value` on `lockScript` must cover **5×** platform deposit. Callbacks may complete in any order.
///      Your `url` must match selector roots (e.g. `results[0].…` for `eventslast.php`, `events[0].…` for `lookupevent.php`).

contract FootballTest {
    IAgentRequester public constant PLATFORM =
        IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776);

    uint256 public constant JSON_API_AGENT_ID = 13174292974160097713;

    uint256 public nextMatchId;
    uint256 public nextScriptId;

    struct Selectors {
        string homeScore;
        string awayScore;
        string status;
        string homeTeam;
        string awayTeam;
    }

    struct MatchConfig {
        string url;
        Selectors sel;
        bool exists;
    }

    /// @dev phase: 0 = unused, 1 = fetching, 2 = settled (success or graded), 3 = fetch failed
    struct ScriptLock {
        address owner;
        uint256 matchId;
        uint8 winnerPick; // 0 Home 1 Draw 2 Away
        uint8 ouPick; // 0 Under 2.5  1 Over 2.5
        uint8 btsPick; // 0 No 1 Yes
        uint8 cleanSheetPick; // 0 No 1 Yes
        uint8 pickHome;
        uint8 pickAway;
        uint256 playAmount; // 1 .. 10000 ($PLAY units for formula only)
        uint8 phase;
        uint8 fetchMask; // bits 0..4 set when fields 1..5 received
        uint256 fetchedHome;
        uint256 fetchedAway;
        string fetchedStatus;
        string fetchedHomeTeam;
        string fetchedAwayTeam;
        uint8 correctSlots;
        uint256 payoutPlay;
    }

    mapping(uint256 => MatchConfig) public matches_;
    mapping(uint256 => ScriptLock) public scripts;
    /// @dev Packed: high 248 bits = scriptId, low 8 bits = field 1..5
    mapping(uint256 => uint256) public pendingFetch;

    event MatchRegistered(uint256 indexed matchId, string url);
    event ScriptLocked(uint256 indexed scriptId, uint256 indexed matchId, address owner, uint256 playAmount);
    event FootballFetchFailed(uint256 indexed scriptId, uint8 field, ResponseStatus status);
    event ScriptSettled(
        uint256 indexed scriptId,
        uint8 correctSlots,
        uint256 payoutPlay,
        uint256 homeScore,
        uint256 awayScore,
        string status
    );

    function registerEvent(
        string calldata url,
        string calldata selHomeScore,
        string calldata selAwayScore,
        string calldata selStatus,
        string calldata selHomeTeam,
        string calldata selAwayTeam
    ) external returns (uint256 matchId) {
        matchId = nextMatchId++;
        MatchConfig storage m = matches_[matchId];
        m.url = url;
        m.sel.homeScore = selHomeScore;
        m.sel.awayScore = selAwayScore;
        m.sel.status = selStatus;
        m.sel.homeTeam = selHomeTeam;
        m.sel.awayTeam = selAwayTeam;
        m.exists = true;
        emit MatchRegistered(matchId, url);
    }

    /// @notice Locks a script and starts 5 agent fetches for the registered match URL.
    /// @param winnerPick 0=Home 1=Draw 2=Away
    /// @param ouPick 0=Under 2.5  1=Over 2.5
    /// @param btsPick 0=No 1=Yes (both teams score)
    /// @param cleanSheetPick 0=No 1=Yes (per protocol: any side held to 0 goals)
    /// @param playAmount 1–10000; payout = playAmount * tierMultiplier / 10 (3x → 30/10, 1.8x → 18/10, 1.2x → 12/10)
    function lockScript(
        uint256 matchId,
        uint8 winnerPick,
        uint8 ouPick,
        uint8 btsPick,
        uint8 cleanSheetPick,
        uint8 pickHome,
        uint8 pickAway,
        uint256 playAmount
    ) external payable returns (uint256 scriptId) {
        require(matches_[matchId].exists, "FootballTest: unknown match");
        require(winnerPick <= 2 && ouPick <= 1 && btsPick <= 1 && cleanSheetPick <= 1, "FootballTest: bad picks");
        require(playAmount >= 1 && playAmount <= 10_000, "FootballTest: playAmount");
        uint256 dep = PLATFORM.getRequestDeposit();
        require(msg.value >= dep * 5, "FootballTest: need 5x deposit");

        scriptId = nextScriptId++;
        ScriptLock storage s = scripts[scriptId];
        s.owner = msg.sender;
        s.matchId = matchId;
        s.winnerPick = winnerPick;
        s.ouPick = ouPick;
        s.btsPick = btsPick;
        s.cleanSheetPick = cleanSheetPick;
        s.pickHome = pickHome;
        s.pickAway = pickAway;
        s.playAmount = playAmount;
        s.phase = 1;

        emit ScriptLocked(scriptId, matchId, msg.sender, playAmount);

        for (uint8 f = 1; f <= 5; ++f) {
            _requestField(scriptId, f);
        }

        if (msg.value > dep * 5) {
            payable(msg.sender).transfer(msg.value - dep * 5);
        }
    }

    function handleFootballFetch(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external {
        require(msg.sender == address(PLATFORM), "FootballTest: only platform");
        uint256 packed = pendingFetch[requestId];
        require(packed != 0, "FootballTest: unknown request");
        delete pendingFetch[requestId];

        uint256 scriptId = packed >> 8;
        uint8 field = uint8(packed & 0xff);
        ScriptLock storage s = scripts[scriptId];
        require(s.phase == 1, "FootballTest: bad phase");

        if (status != ResponseStatus.Success || responses.length == 0) {
            s.phase = 3;
            emit FootballFetchFailed(scriptId, field, status);
            return;
        }

        if (field == 1) {
            s.fetchedHome = abi.decode(responses[0].result, (uint256));
            s.fetchMask |= uint8(1);
        } else if (field == 2) {
            s.fetchedAway = abi.decode(responses[0].result, (uint256));
            s.fetchMask |= uint8(1) << 1;
        } else if (field == 3) {
            s.fetchedStatus = abi.decode(responses[0].result, (string));
            s.fetchMask |= uint8(1) << 2;
        } else if (field == 4) {
            s.fetchedHomeTeam = abi.decode(responses[0].result, (string));
            s.fetchMask |= uint8(1) << 3;
        } else if (field == 5) {
            s.fetchedAwayTeam = abi.decode(responses[0].result, (string));
            s.fetchMask |= uint8(1) << 4;
        }

        if (s.fetchMask == 0x1F && s.phase == 1) {
            _settle(scriptId);
        }
    }

    function _settle(uint256 scriptId) internal {
        ScriptLock storage s = scripts[scriptId];
        uint256 h = s.fetchedHome;
        uint256 a = s.fetchedAway;

        uint8 ok;
        // Slot 1 — winner
        uint8 actualW = h > a ? uint8(0) : (a > h ? uint8(2) : uint8(1));
        if (s.winnerPick == actualW) ok++;

        // Slot 2 — O/U 2.5
        bool over = h + a > 2;
        if ((over && s.ouPick == 1) || (!over && s.ouPick == 0)) ok++;

        // Slot 3 — BTS
        bool bts = h > 0 && a > 0;
        if ((bts && s.btsPick == 1) || (!bts && s.btsPick == 0)) ok++;

        // Slot 4 — clean sheet (Yes if either team 0)
        bool cs = a == 0 || h == 0;
        if ((cs && s.cleanSheetPick == 1) || (!cs && s.cleanSheetPick == 0)) ok++;

        // Slot 5 — exact score
        if (s.pickHome == h && s.pickAway == a) ok++;

        uint256 payout;
        if (ok >= 5) {
            payout = s.playAmount * 30 / 10;
        } else if (ok == 4) {
            payout = s.playAmount * 18 / 10;
        } else if (ok == 3) {
            payout = s.playAmount * 12 / 10;
        }

        s.correctSlots = ok;
        s.payoutPlay = payout;
        s.phase = 2;

        emit ScriptSettled(scriptId, ok, payout, h, a, s.fetchedStatus);
    }

    function _requestField(uint256 scriptId, uint8 field) internal {
        MatchConfig storage m = matches_[scripts[scriptId].matchId];
        uint256 dep = PLATFORM.getRequestDeposit();
        bytes memory payload;

        if (field <= 2) {
            string memory sel = field == 1 ? m.sel.homeScore : m.sel.awayScore;
            payload = abi.encodeWithSelector(IJsonApiAgent.fetchUint.selector, m.url, sel, uint8(0));
        } else {
            string memory sel = field == 3
                ? m.sel.status
                : field == 4 ? m.sel.homeTeam : m.sel.awayTeam;
            payload = abi.encodeWithSelector(IJsonApiAgent.fetchString.selector, m.url, sel);
        }

        uint256 requestId = PLATFORM.createRequest{value: dep}(
            JSON_API_AGENT_ID,
            address(this),
            this.handleFootballFetch.selector,
            payload
        );
        pendingFetch[requestId] = (scriptId << 8) | uint256(field);
    }

    function getRequiredDepositTotal() external view returns (uint256) {
        return PLATFORM.getRequestDeposit() * 5;
    }

    receive() external payable {}
}
