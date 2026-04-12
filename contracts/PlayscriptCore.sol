// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAgentRequester, IJsonApiAgent, Request, Response, ResponseStatus} from "./interfaces/ISomniaAgents.sol";
import {PlayToken} from "./PlayToken.sol";

/// @title PlayscriptCore
/// @notice Production Playscript: PLAY stakes, kickoff lock window, settle after kickoff + finalize delay,
///         parallel JSON agent fetches, multi-sport 5-slot grading (rules aligned with `lib/script-slot-outcomes.ts`),
///         mint payouts + 5% fee, loser stake to treasury, shareable `choicesReceipt`, `lockReplay`.
///
/// ## `picksPacked` (single `uint256`, low bits first)
/// **All sports:** bits `0–1` + next bits for winner (2 bits, values 0–2): Soccer `0=Home 1=Draw 2=Away`;
/// Basketball/NFL/MLB `0=Home 1=Away 2=Tie` (tie rare). Bit `2` O/U (0=under 1=over); bits `3–5` yes/no slots 3–5.
/// Lines: Soccer total 2.5; Basketball 220.5; NFL 43.5; MLB 8.5.
///
/// **Soccer only:** bits `8–15` exact home goals, `16–23` exact away goals (uint8 each).
///
/// **Shareable receipt:** `choicesReceipt = keccak256(abi.encodePacked(matchId, uint8(sport), picksPacked))`.
/// Anyone with `(matchId, sport, picksPacked)` can verify it matches on-chain; `lockReplay` copies `picksPacked`
/// from an existing `scriptId` for the same `matchId`.
contract PlayscriptCore {
    IAgentRequester public constant PLATFORM =
        IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776);

    uint256 public constant JSON_API_AGENT_ID = 13174292974160097713;

    /// @dev Must match frontend `ScriptSportKey` order in `lib/script-slots.ts`
    enum Sport {
        Soccer,
        Basketball,
        NFL,
        MLB
    }

    struct Selectors {
        string homeScore;
        string awayScore;
        string status;
        string homeTeam;
        string awayTeam;
    }

    struct Match {
        Sport sport;
        uint64 kickoff;
        uint32 finalizeDelaySec;
        string url;
        Selectors sel;
        bool exists;
        bool settled;
        bool settleInProgress;
        uint8 fetchMask;
        uint256 finalHome;
        uint256 finalAway;
    }

    struct Script {
        address owner;
        uint256 matchId;
        uint256 stake;
        uint256 picksPacked;
        bytes32 choicesReceipt;
        bool claimed;
    }

    PlayToken public immutable PLAY;
    address public immutable treasury;
    address public owner;

    uint256 public nextMatchId;
    uint256 public nextScriptId;

    mapping(uint256 => Match) public matches_;
    mapping(uint256 => Script) public scripts;
    mapping(uint256 => uint256) public pendingSettleFetch;

    uint256 public constant DEFAULT_FINALIZE_DELAY = 7200;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event MatchRegistered(
        uint256 indexed matchId,
        uint8 indexed sport,
        uint64 kickoff,
        uint32 finalizeDelaySec,
        uint64 finalizeAfter,
        string url
    );
    event ScriptLocked(
        uint256 indexed scriptId,
        uint256 indexed matchId,
        uint8 indexed sport,
        address owner,
        uint256 stake,
        uint256 picksPacked,
        bytes32 choicesReceipt
    );
    event MatchSettled(uint256 indexed matchId, uint256 finalHome, uint256 finalAway);
    event MatchSettleFetchFailed(uint256 indexed matchId, uint8 field, ResponseStatus status);
    event PayoutClaimed(uint256 indexed scriptId, address indexed owner, uint8 correctSlots, uint256 mintedToUser, uint256 mintedFee);

    error Unauthorized();
    error InvalidAddress();
    error BadMatch();
    error BadTime();
    error InsufficientValue();
    error BadPicks();
    error BadStake();
    error AlreadySettled();
    error NotSettled();
    error AlreadyClaimed();
    error SettleInFlight();
    error TemplateMismatch();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(PlayToken play, address treasury_, address initialOwner) {
        if (address(play) == address(0) || treasury_ == address(0) || initialOwner == address(0)) {
            revert InvalidAddress();
        }
        PLAY = play;
        treasury = treasury_;
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Register a match. `sport` matches `PlayscriptCore.Sport` / frontend sport key index.
    /// @param finalizeDelaySec Seconds after kickoff when settlement may begin (default 7200 in script if 0).
    function registerMatch(
        uint8 sport,
        uint64 kickoff,
        uint32 finalizeDelaySec,
        string calldata url,
        string calldata selHomeScore,
        string calldata selAwayScore,
        string calldata selStatus,
        string calldata selHomeTeam,
        string calldata selAwayTeam
    ) external onlyOwner returns (uint256 matchId) {
        if (sport > uint8(Sport.MLB)) revert BadPicks();
        uint32 delay = finalizeDelaySec == 0 ? uint32(DEFAULT_FINALIZE_DELAY) : finalizeDelaySec;
        matchId = nextMatchId++;
        Match storage m = matches_[matchId];
        m.sport = Sport(sport);
        m.kickoff = kickoff;
        m.finalizeDelaySec = delay;
        m.url = url;
        m.sel.homeScore = selHomeScore;
        m.sel.awayScore = selAwayScore;
        m.sel.status = selStatus;
        m.sel.homeTeam = selHomeTeam;
        m.sel.awayTeam = selAwayTeam;
        m.exists = true;
        uint64 finalizeAfter = kickoff + uint64(delay);
        emit MatchRegistered(matchId, sport, kickoff, delay, finalizeAfter, url);
    }

    /// @notice Lock picks + PLAY stake. `picksPacked` layout depends on `matches_[matchId].sport` (see `_validatePicks`).
    function lockScript(uint256 matchId, uint256 picksPacked, uint256 stake) external returns (uint256 scriptId) {
        return _lock(msg.sender, matchId, picksPacked, stake);
    }

    /// @notice Copy another user's packed picks for the same match (same `choicesReceipt` if same picks).
    function lockReplay(uint256 matchId, uint256 templateScriptId, uint256 stake) external returns (uint256 scriptId) {
        Script storage t = scripts[templateScriptId];
        if (t.matchId != matchId) revert TemplateMismatch();
        return _lock(msg.sender, matchId, t.picksPacked, stake);
    }

    /// @notice After kickoff + finalize delay, anyone may trigger parallel agent reads once per match. Send **5×** platform deposit as `msg.value`.
    function settleMatch(uint256 matchId) external payable {
        Match storage m = matches_[matchId];
        if (!m.exists) revert BadMatch();
        if (m.settled) revert AlreadySettled();
        if (m.settleInProgress) revert SettleInFlight();
        if (block.timestamp < uint256(m.kickoff) + uint256(m.finalizeDelaySec)) revert BadTime();

        uint256 dep = PLATFORM.getRequestDeposit();
        uint256 need = dep * 5;
        if (msg.value < need) revert InsufficientValue();

        m.settleInProgress = true;
        for (uint8 f = 1; f <= 5; ++f) {
            _requestSettleField(matchId, f);
        }

        if (msg.value > need) {
            payable(msg.sender).transfer(msg.value - need);
        }
    }

    function handleSettleFetch(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory /* details */
    ) external {
        if (msg.sender != address(PLATFORM)) revert Unauthorized();
        uint256 packed = pendingSettleFetch[requestId];
        if (packed == 0) revert BadMatch();
        delete pendingSettleFetch[requestId];

        uint256 matchId = packed >> 8;
        uint8 field = uint8(packed & 0xff);
        Match storage m = matches_[matchId];
        if (!m.settleInProgress || m.settled) revert BadMatch();

        if (status != ResponseStatus.Success || responses.length == 0) {
            m.settleInProgress = false;
            m.fetchMask = 0;
            emit MatchSettleFetchFailed(matchId, field, status);
            return;
        }

        if (field == 1) {
            m.finalHome = abi.decode(responses[0].result, (uint256));
            m.fetchMask |= uint8(1);
        } else if (field == 2) {
            m.finalAway = abi.decode(responses[0].result, (uint256));
            m.fetchMask |= uint8(1) << 1;
        } else if (field == 3) {
            abi.decode(responses[0].result, (string));
            m.fetchMask |= uint8(1) << 2;
        } else if (field == 4) {
            abi.decode(responses[0].result, (string));
            m.fetchMask |= uint8(1) << 3;
        } else if (field == 5) {
            abi.decode(responses[0].result, (string));
            m.fetchMask |= uint8(1) << 4;
        }

        if (m.fetchMask == 0x1F) {
            m.settled = true;
            m.settleInProgress = false;
            emit MatchSettled(matchId, m.finalHome, m.finalAway);
        }
    }

    /// @notice Claim after match settled: winners minted (stake×tier, 5% fee on mint to treasury); stake sent to treasury.
    function claimPayout(uint256 scriptId) external {
        Script storage s = scripts[scriptId];
        if (s.claimed) revert AlreadyClaimed();
        Match storage m = matches_[s.matchId];
        if (!m.settled) revert NotSettled();

        uint8 ok = _grade(m.sport, s.picksPacked, m.finalHome, m.finalAway);

        uint256 mintUser;
        uint256 mintFee;
        if (ok >= 3) {
            uint256 multBps = ok >= 5 ? 30 : (ok == 4 ? 18 : 12);
            uint256 payout = (s.stake * multBps) / 10;
            mintFee = (payout * 5) / 100;
            mintUser = payout - mintFee;
            PLAY.mint(s.owner, mintUser);
            PLAY.mint(treasury, mintFee);
        }

        PLAY.transfer(treasury, s.stake);
        s.claimed = true;

        emit PayoutClaimed(scriptId, s.owner, ok, mintUser, mintFee);
    }

    /// @notice Sum of native deposit for one full settlement (5× platform).
    function getSettleDepositTotal() external view returns (uint256) {
        return PLATFORM.getRequestDeposit() * 5;
    }

    function getScript(uint256 scriptId) external view returns (Script memory) {
        return scripts[scriptId];
    }

    function getFinalizeTimestamp(uint256 matchId) external view returns (uint256) {
        Match storage m = matches_[matchId];
        return uint256(m.kickoff) + uint256(m.finalizeDelaySec);
    }

    // --- internal ---

    function _lock(address user, uint256 matchId, uint256 picksPacked, uint256 stake) internal returns (uint256 scriptId) {
        Match storage m = matches_[matchId];
        if (!m.exists || m.settled) revert BadMatch();
        if (block.timestamp >= m.kickoff) revert BadTime();
        if (stake == 0) revert BadStake();
        _validatePicks(m.sport, picksPacked);

        PLAY.transferFrom(user, address(this), stake);

        scriptId = nextScriptId++;
        bytes32 receipt = keccak256(abi.encodePacked(matchId, uint8(m.sport), picksPacked));
        Script storage s = scripts[scriptId];
        s.owner = user;
        s.matchId = matchId;
        s.stake = stake;
        s.picksPacked = picksPacked;
        s.choicesReceipt = receipt;

        emit ScriptLocked(scriptId, matchId, uint8(m.sport), user, stake, picksPacked, receipt);
    }

    function _requestSettleField(uint256 matchId, uint8 field) internal {
        Match storage m = matches_[matchId];
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
            this.handleSettleFetch.selector,
            payload
        );
        pendingSettleFetch[requestId] = (matchId << 8) | uint256(field);
    }

    function _validatePicks(Sport sport, uint256 p) internal pure {
        if (sport == Sport.Soccer) {
            if ((p & 3) > 2) revert BadPicks();
            if (((p >> 2) & 1) > 1) revert BadPicks();
            if (((p >> 3) & 1) > 1) revert BadPicks();
            if (((p >> 4) & 1) > 1) revert BadPicks();
            if (((p >> 8) & 0xFF) > 30 || ((p >> 16) & 0xFF) > 30) revert BadPicks();
        } else {
            if ((p & 3) > 2) revert BadPicks();
            if (((p >> 2) & 1) > 1) revert BadPicks();
            if (((p >> 3) & 1) > 1) revert BadPicks();
            if (((p >> 4) & 1) > 1) revert BadPicks();
            if (((p >> 5) & 1) > 1) revert BadPicks();
        }
    }

    /// @dev `picksPacked` low bits: [0:1] winner (0 Home 1 Away 2 Draw/Tie), [2] ou, [3] slot3, [4] slot4, [5] slot5.
    ///      Soccer only: [8:15] pickHome goals, [16:23] pickAway goals.
    function _grade(Sport sport, uint256 p, uint256 h, uint256 a) internal pure returns (uint8 ok) {
        uint8 w = uint8(p & 3);
        uint8 ou = uint8((p >> 2) & 1);
        uint8 s3 = uint8((p >> 3) & 1);
        uint8 s4 = uint8((p >> 4) & 1);
        uint8 s5 = uint8((p >> 5) & 1);

        if (sport == Sport.Soccer) {
            uint8 ph = uint8((p >> 8) & 0xFF);
            uint8 pa = uint8((p >> 16) & 0xFF);
            uint8 aw;
            if (h > a) aw = 0;
            else if (a > h) aw = 2;
            else aw = 1;
            if (w == aw) ok++;
            bool over = h + a > 2;
            if ((over && ou == 1) || (!over && ou == 0)) ok++;
            bool bts = h > 0 && a > 0;
            if ((bts && s3 == 1) || (!bts && s3 == 0)) ok++;
            bool cs = a == 0 || h == 0;
            if ((cs && s4 == 1) || (!cs && s4 == 0)) ok++;
            if (ph == uint8(h) && pa == uint8(a)) ok++;
        } else if (sport == Sport.Basketball) {
            uint8 aw;
            if (h > a) aw = 0;
            else if (a > h) aw = 1;
            else aw = 2;
            if (w == aw) ok++;
            uint256 pts = h + a;
            bool over = 2 * pts > 441;
            if ((over && ou == 1) || (!over && ou == 0)) ok++;
            bool both100 = h >= 100 && a >= 100;
            if ((both100 && s3 == 1) || (!both100 && s3 == 0)) ok++;
            bool c230 = pts >= 230;
            if ((c230 && s4 == 1) || (!c230 && s4 == 0)) ok++;
            uint256 margin = h > a ? h - a : a - h;
            bool blow = h != a && margin >= 10;
            if ((blow && s5 == 1) || (!blow && s5 == 0)) ok++;
        } else if (sport == Sport.NFL) {
            uint8 aw;
            if (h > a) aw = 0;
            else if (a > h) aw = 1;
            else aw = 2;
            if (w == aw) ok++;
            uint256 pts = h + a;
            bool over = 2 * pts > 87;
            if ((over && ou == 1) || (!over && ou == 0)) ok++;
            bool both20 = h >= 20 && a >= 20;
            if ((both20 && s3 == 1) || (!both20 && s3 == 0)) ok++;
            bool c50 = pts >= 50;
            if ((c50 && s4 == 1) || (!c50 && s4 == 0)) ok++;
            uint256 margin = h > a ? h - a : a - h;
            bool blow = h != a && margin >= 10;
            if ((blow && s5 == 1) || (!blow && s5 == 0)) ok++;
        } else {
            uint8 aw;
            if (h > a) aw = 0;
            else if (a > h) aw = 1;
            else aw = 2;
            if (w == aw) ok++;
            uint256 runs = h + a;
            bool over = 2 * runs > 17;
            if ((over && ou == 1) || (!over && ou == 0)) ok++;
            bool both3 = h >= 3 && a >= 3;
            if ((both3 && s3 == 1) || (!both3 && s3 == 0)) ok++;
            bool c10 = runs >= 10;
            if ((c10 && s4 == 1) || (!c10 && s4 == 0)) ok++;
            uint256 margin = h > a ? h - a : a - h;
            bool m3 = h != a && margin >= 3;
            if ((m3 && s5 == 1) || (!m3 && s5 == 0)) ok++;
        }
    }

    receive() external payable {}
}
