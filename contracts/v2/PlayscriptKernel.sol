// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IAgentRequester, IJsonApiAgent, Request, Response, ResponseStatus} from "../interfaces/ISomniaAgents.sol";

import {IPlayscriptScheduler} from "./IPlayscriptScheduler.sol";
import {IPlayVault} from "./IPlayVault.sol";
import {LegBitmask} from "./LegBitmask.sol";
import {PlayscriptPayout} from "./PlayscriptPayout.sol";
import {PlayscriptV2Grading} from "./PlayscriptV2Grading.sol";

interface IERC20Balances {
    function balanceOf(address account) external view returns (uint256);
}

/// @title PlayscriptKernel
/// @notice Match ledger with 12 weighted legs + Somnia JSON API settlement (ESPN: 2–8 `fetchUint` calls per sport).
/// @dev Leg masks use 12 bits; exactly 5 must be set for a valid script difficulty score. Scheduler callbacks use `msg.value == 0`;
///      `startSettle` needs the kernel to hold `5 × _perAgentDeposit()` unless someone uses `settleMatchPayable`.
contract PlayscriptKernel {
    using LegBitmask for uint16;

    IAgentRequester public constant PLATFORM =
        IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776);

    uint256 public constant JSON_API_AGENT_ID = 13174292974160097713;

    /// @notice Minimum native per `createRequest` (0.12 SOMI). JSON API often bills ~0.12 while `getRequestDeposit()` is lower.
    uint256 public constant MIN_AGENT_NATIVE_WEI = 120_000_000_000_000_000;

    enum MatchState {
        OPEN,
        LOCKED,
        RESOLVING,
        SETTLED
    }

    enum Sport {
        Soccer,
        Basketball,
        NFL,
        MLB
    }

    struct Selectors {
        string homeScore;
        string awayScore;
        string htHome;
        string htAway;
        string yellowHome;
        string yellowAway;
        string redHome;
        string redAway;
        string homeQ1;
        string homeQ2;
        string awayQ1;
        string awayQ2;
    }

    struct Match {
        Sport sport;
        uint64 kickoff;
        uint32 finalizeDelaySec;
        /// @notice Primary match key (`summary` for soccer, `scoreboard` for US sports).
        string url;
        string scoreboardUrl;
        string summaryUrl;
        Selectors sel;
        MatchState state;
        uint8[12] legKinds;
        uint8[12] legWeights;
        bool exists;
        bool settled;
        bool settleInProgress;
        uint16 fetchMask;
        uint256 finalHome;
        uint256 finalAway;
        uint256 htHome;
        uint256 htAway;
        uint256 yellowHome;
        uint256 yellowAway;
        uint256 redHome;
        uint256 redAway;
        uint256 homeQ1;
        uint256 homeQ2;
        uint256 awayQ1;
        uint256 awayQ2;
        /// @notice Which of 12 legs hit at settlement (bits 0–11). `playscript.md` §8.
        uint16 resolvedLegsBitmask;
        /// @notice Reserved vault liability at registration — 9.8% of vault PLAY at that time (`playscript.md` §6).
        uint256 matchLiabilityCap;
        /// @notice Committed winner liability from `lockScript` fills toward `matchLiabilityCap` (`playscript.md` §9).
        uint256 matchLiability;
    }

    address public owner;
    address public scheduler;
    /// @notice `PlayscriptV2Positions` — may call `recordLockLiability` / `payClaim`.
    address public positions;
    /// @notice `PlayVault` — zero disables vault checks and liability hooks.
    address public vault;

    /// @notice After a failed settlement fetch, push `finalizeDelaySec` forward and schedule another `startSettle`
    ///         this many seconds later. Default **60** (1 minute) for testnet; owner may set e.g. **900** (15 minutes).
    uint32 public settleRetryDelaySec = 60;

    uint256 public nextMatchId;
    mapping(uint256 => Match) internal _matches;
    mapping(uint256 => uint256) public pendingSettleFetch;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SchedulerSet(address indexed scheduler);
    event MatchRegistered(
        uint256 indexed matchId,
        uint8 sport,
        uint64 kickoff,
        uint32 finalizeDelaySec,
        uint64 finalizeAfterSec,
        string url
    );
    event MatchLocked(uint256 indexed matchId, uint256 timestamp);
    event ResolutionStarted(uint256 indexed matchId, uint256 timestamp);
    event MatchSettled(uint256 indexed matchId, uint256 finalHome, uint256 finalAway, uint16 resolvedLegsBitmask);
    event PositionsSet(address indexed positions);
    event LockLiabilityRecorded(uint256 indexed matchId, uint256 liabilityAdded, uint256 matchLiability);
    event ScriptPaid(uint256 indexed matchId, uint16 legMask12, address indexed to, uint256 payout);
    event MatchSettleFetchFailed(uint256 indexed matchId, uint8 field, ResponseStatus status);
    event SettleRetryScheduled(
        uint256 indexed matchId,
        uint32 newFinalizeDelaySec,
        uint64 retryAtSec,
        uint8 field,
        ResponseStatus status
    );
    event SettleRetryDelaySecSet(uint32 settleRetryDelaySec);
    event VaultSet(address indexed vault);

    error Unauthorized();
    error BadKickoff();
    error BadWeights();
    error BadMatch();
    error BadState();
    error SchedulerUnset();
    error BadTime();
    error InsufficientValue();
    error AlreadySettled();
    error SettleInFlight();
    error WithdrawFailed();
    error VaultFull();
    error BadRetryDelay();
    error NotWinner();
    error ZeroPayout();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyScheduler() {
        if (msg.sender != scheduler) revert Unauthorized();
        _;
    }

    modifier onlyPositions() {
        if (msg.sender != positions) revert Unauthorized();
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert Unauthorized();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    receive() external payable {}

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert Unauthorized();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setScheduler(address sched) external onlyOwner {
        scheduler = sched;
        emit SchedulerSet(sched);
    }

    function setVault(address vault_) external onlyOwner {
        vault = vault_;
        emit VaultSet(vault_);
    }

    function setPositions(address positions_) external onlyOwner {
        positions = positions_;
        emit PositionsSet(positions_);
    }

    /// @notice Seconds to wait before retrying settlement after a failed JSON agent fetch (min 30).
    function setSettleRetryDelaySec(uint32 delaySec) external onlyOwner {
        if (delaySec < 30) revert BadRetryDelay();
        settleRetryDelaySec = delaySec;
        emit SettleRetryDelaySecSet(delaySec);
    }

    /// @notice Owner: send native balance out (e.g. excess SOMI). Owner is trusted not to strand in-flight settlement.
    function withdrawNative(address payable to, uint256 amount) external onlyOwner {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert WithdrawFailed();
    }

    /// @notice Register a match, store JSON selectors, schedule Reactivity host callbacks.
    /// @dev Permissionless: any address may register a future kickoff. Owner still controls `setScheduler`.
    function registerMatch(
        Sport sport,
        uint64 kickoff,
        uint32 finalizeDelaySec,
        string calldata url,
        string calldata scoreboardUrl,
        string calldata summaryUrl,
        string calldata selHomeScore,
        string calldata selAwayScore,
        string calldata selHtHome,
        string calldata selHtAway,
        string calldata selYellowHome,
        string calldata selYellowAway,
        string calldata selRedHome,
        string calldata selRedAway,
        string calldata selHomeQ1,
        string calldata selHomeQ2,
        string calldata selAwayQ1,
        string calldata selAwayQ2,
        uint8[12] calldata legKinds,
        uint8[12] calldata legWeights
    ) external returns (uint256 matchId) {
        if (kickoff <= block.timestamp) revert BadKickoff();
        _validateWeights(legWeights);

        matchId = nextMatchId++;
        uint64 finalizeAfterSec = kickoff + uint64(finalizeDelaySec);

        uint256 liabilityCap;
        address vAddr = vault;
        if (vAddr != address(0)) {
            address playAddr = IPlayVault(vAddr).PLAY();
            uint256 vaultBal = IERC20Balances(playAddr).balanceOf(vAddr);
            liabilityCap = (vaultBal * 98) / 1000;
            uint256 hardFloor = (vaultBal * 200) / 10_000;
            if (liabilityCap > 0) {
                uint256 liab = IPlayVault(vAddr).totalOutstandingLiability();
                if (liab + liabilityCap > vaultBal - hardFloor) revert VaultFull();
                IPlayVault(vAddr).addLiability(liabilityCap);
            }
        }

        _matches[matchId] = Match({
            sport: sport,
            kickoff: kickoff,
            finalizeDelaySec: finalizeDelaySec,
            url: url,
            scoreboardUrl: scoreboardUrl,
            summaryUrl: summaryUrl,
            sel: Selectors({
                homeScore: selHomeScore,
                awayScore: selAwayScore,
                htHome: selHtHome,
                htAway: selHtAway,
                yellowHome: selYellowHome,
                yellowAway: selYellowAway,
                redHome: selRedHome,
                redAway: selRedAway,
                homeQ1: selHomeQ1,
                homeQ2: selHomeQ2,
                awayQ1: selAwayQ1,
                awayQ2: selAwayQ2
            }),
            state: MatchState.OPEN,
            legKinds: legKinds,
            legWeights: legWeights,
            exists: true,
            settled: false,
            settleInProgress: false,
            fetchMask: 0,
            finalHome: 0,
            finalAway: 0,
            htHome: 0,
            htAway: 0,
            yellowHome: 0,
            yellowAway: 0,
            redHome: 0,
            redAway: 0,
            homeQ1: 0,
            homeQ2: 0,
            awayQ1: 0,
            awayQ2: 0,
            resolvedLegsBitmask: 0,
            matchLiabilityCap: liabilityCap,
            matchLiability: 0
        });

        emit MatchRegistered(
            matchId,
            uint8(sport),
            kickoff,
            finalizeDelaySec,
            finalizeAfterSec,
            url
        );

        if (scheduler == address(0)) revert SchedulerUnset();
        IPlayscriptScheduler(scheduler).scheduleMatch(matchId, kickoff, finalizeAfterSec);
    }

    /// @notice Scheduler only: transition OPEN → LOCKED at kickoff time.
    function lockKickoff(uint256 matchId) external onlyScheduler {
        Match storage m = _matches[matchId];
        if (!m.exists) revert BadMatch();
        if (m.state != MatchState.OPEN) revert BadState();
        m.state = MatchState.LOCKED;
        emit MatchLocked(matchId, block.timestamp);
    }

    /// @notice Scheduler only: start settlement (5 JSON fetches); pays from kernel balance (`msg.value` is 0).
    function startSettle(uint256 matchId) external onlyScheduler {
        _beginSettlement(matchId, 0);
    }

    /// @notice Anyone: pay native deposits like PlayscriptCore `settleMatch` (msg.value ≥ 5× deposit).
    function settleMatchPayable(uint256 matchId) external payable {
        _beginSettlement(matchId, msg.value);
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
        Match storage m = _matches[matchId];
        if (!m.settleInProgress || m.settled) revert BadMatch();

        if (status != ResponseStatus.Success || responses.length == 0) {
            _abortSettleFetch(m, matchId, field, status);
            return;
        }

        uint256 val = abi.decode(responses[0].result, (uint256));
        if (field == 1) {
            m.finalHome = val;
        } else if (field == 2) {
            m.finalAway = val;
        } else if (field == 3) {
            m.htHome = val;
        } else if (field == 4) {
            m.htAway = val;
        } else if (field == 5) {
            m.yellowHome = val;
        } else if (field == 6) {
            m.yellowAway = val;
        } else if (field == 7) {
            m.redHome = val;
        } else if (field == 8) {
            m.redAway = val;
        } else if (field == 9) {
            m.homeQ1 = val;
        } else if (field == 10) {
            m.homeQ2 = val;
        } else if (field == 11) {
            m.awayQ1 = val;
        } else if (field == 12) {
            m.awayQ2 = val;
        } else {
            _abortSettleFetch(m, matchId, field);
            return;
        }
        m.fetchMask |= uint16(1) << (field - 1);

        if (m.fetchMask == _requiredFetchMask(m.sport)) {
            _finalizeSettlement(matchId, m);
        }
    }

    /// @notice Available PLAY liability room for a new lock (`playscript.md` §9 step 4).
    function lockRoom(uint256 matchId) external view returns (uint256) {
        Match storage m = _matches[matchId];
        if (!m.exists) revert BadMatch();
        uint256 matchRoom = m.matchLiabilityCap > m.matchLiability ? m.matchLiabilityCap - m.matchLiability : 0;
        address vAddr = vault;
        if (vAddr == address(0)) return matchRoom;
        address playAddr = IPlayVault(vAddr).PLAY();
        uint256 vaultBal = IERC20Balances(playAddr).balanceOf(vAddr);
        uint256 liab = IPlayVault(vAddr).totalOutstandingLiability();
        uint256 hardFloor = (vaultBal * 200) / 10_000;
        uint256 globalRoom = vaultBal > liab + hardFloor ? vaultBal - liab - hardFloor : 0;
        return matchRoom < globalRoom ? matchRoom : globalRoom;
    }

    function getPayoutRate(uint256 score) external pure returns (uint256) {
        return PlayscriptPayout.payoutRate(score);
    }

    function payoutRateForMask(uint256 matchId, uint16 legMask12) external view returns (uint256 rate) {
        return PlayscriptPayout.payoutRate(_difficultyScore(matchId, legMask12));
    }

    function isWinningMask(uint256 matchId, uint16 legMask12) external view returns (bool) {
        Match storage m = _matches[matchId];
        if (!m.exists || !m.settled) return false;
        if (!legMask12.hasExactBits(5)) return false;
        return (legMask12 & m.resolvedLegsBitmask) == legMask12;
    }

    /// @notice Positions: after burning ERC-1155, pay winner from vault (`playscript.md` §15).
    function payClaim(uint256 matchId, uint16 legMask12, uint256 netStake, address to) external onlyPositions {
        if (to == address(0)) revert Unauthorized();
        Match storage m = _matches[matchId];
        if (!m.exists || !m.settled) revert BadState();
        if (!legMask12.hasExactBits(5)) revert BadMatch();
        if ((legMask12 & m.resolvedLegsBitmask) != legMask12) revert NotWinner();

        uint256 score = _difficultyScore(matchId, legMask12);
        uint256 rate = PlayscriptPayout.payoutRate(score);
        uint256 payout = PlayscriptPayout.payoutAmount(netStake, rate);
        if (payout == 0) revert ZeroPayout();

        address vAddr = vault;
        if (vAddr == address(0)) revert BadMatch();
        IPlayVault(vAddr).pay(to, payout);
        emit ScriptPaid(matchId, legMask12, to, payout);
    }

    /// @notice Positions: track committed liability toward this match cap (`playscript.md` §9).
    function recordLockLiability(uint256 matchId, uint256 liabilityAdded) external onlyPositions {
        if (liabilityAdded == 0) revert BadMatch();
        Match storage m = _matches[matchId];
        if (!m.exists) revert BadMatch();
        if (m.state != MatchState.OPEN) revert BadState();
        unchecked {
            m.matchLiability += liabilityAdded;
        }
        if (m.matchLiability > m.matchLiabilityCap) revert VaultFull();
        emit LockLiabilityRecorded(matchId, liabilityAdded, m.matchLiability);
    }

    /// @notice Positions: unwind during `OPEN` — free match liability room.
    function reduceLockLiability(uint256 matchId, uint256 liabilityRemoved) external onlyPositions {
        Match storage m = _matches[matchId];
        if (!m.exists) revert BadMatch();
        if (m.state != MatchState.OPEN) revert BadState();
        if (liabilityRemoved == 0) return;
        if (m.matchLiability <= liabilityRemoved) {
            m.matchLiability = 0;
        } else {
            unchecked {
                m.matchLiability -= liabilityRemoved;
            }
        }
    }

    function getSettleDepositTotal(Sport sport) external view returns (uint256) {
        return _perAgentDeposit() * _fetchFieldCount(sport);
    }

    function matches(uint256 matchId) external view returns (Match memory) {
        return _matches[matchId];
    }

    function difficultyScore(uint256 matchId, uint16 legMask12) public view returns (uint256 score) {
        return _difficultyScore(matchId, legMask12);
    }

    function _difficultyScore(uint256 matchId, uint16 legMask12) internal view returns (uint256 score) {
        Match storage m = _matches[matchId];
        if (!m.exists) revert BadMatch();
        if (!legMask12.hasExactBits(5)) revert BadMatch();
        unchecked {
            for (uint256 i; i < 12; ++i) {
                if ((legMask12 >> i) & 1 == 1) {
                    score += m.legWeights[i];
                }
            }
        }
    }

    function _beginSettlement(uint256 matchId, uint256 msgValue) internal {
        Match storage m = _matches[matchId];
        if (!m.exists) revert BadMatch();
        if (m.settled) revert AlreadySettled();
        if (m.settleInProgress) revert SettleInFlight();
        if (block.timestamp < uint256(m.kickoff) + uint256(m.finalizeDelaySec)) revert BadTime();
        if (m.state != MatchState.LOCKED) revert BadState();

        uint256 dep = _perAgentDeposit();
        uint8 n = _fetchFieldCount(m.sport);
        uint256 need = dep * n;

        if (msgValue >= need) {
            if (msgValue > need) {
                payable(msg.sender).transfer(msgValue - need);
            }
        } else if (address(this).balance < need) {
            revert InsufficientValue();
        }

        m.settleInProgress = true;
        m.state = MatchState.RESOLVING;

        emit ResolutionStarted(matchId, block.timestamp);

        for (uint8 f = 1; f <= n; ++f) {
            _requestSettleField(matchId, f, dep);
        }
    }

    function _requestSettleField(uint256 matchId, uint8 field, uint256 dep) internal {
        Match storage m = _matches[matchId];
        (string memory fetchUrl, string memory sel) = _settleUrlAndSelector(m, field);

        bytes memory payload =
            abi.encodeWithSelector(IJsonApiAgent.fetchUint.selector, fetchUrl, sel, uint8(0));

        uint256 requestId = PLATFORM.createRequest{value: dep}(
            JSON_API_AGENT_ID,
            address(this),
            this.handleSettleFetch.selector,
            payload
        );
        pendingSettleFetch[requestId] = (matchId << 8) | uint256(field);
    }

    /// @dev Bump `finalizeDelaySec` so `kickoff + finalizeDelaySec == retryAt`, then register a host Schedule for `retryAt`.
    function _perAgentDeposit() internal view returns (uint256) {
        uint256 d = PLATFORM.getRequestDeposit();
        return d > MIN_AGENT_NATIVE_WEI ? d : MIN_AGENT_NATIVE_WEI;
    }

    function _settleUrlAndSelector(Match storage m, uint8 field)
        internal
        view
        returns (string memory fetchUrl, string memory sel)
    {
        Sport sport = m.sport;
        if (sport == Sport.Soccer) {
            if (field <= 2) {
                return (m.scoreboardUrl, field == 1 ? m.sel.homeScore : m.sel.awayScore);
            }
            if (field == 3) return (m.summaryUrl, m.sel.htHome);
            if (field == 4) return (m.summaryUrl, m.sel.htAway);
            if (field == 5) return (m.summaryUrl, m.sel.yellowHome);
            if (field == 6) return (m.summaryUrl, m.sel.yellowAway);
            if (field == 7) return (m.summaryUrl, m.sel.redHome);
            if (field == 8) return (m.summaryUrl, m.sel.redAway);
        } else {
            fetchUrl = m.scoreboardUrl;
            if (field == 1) return (fetchUrl, m.sel.homeScore);
            if (field == 2) return (fetchUrl, m.sel.awayScore);
            if (field == 3) return (fetchUrl, m.sel.homeQ1);
            if (field == 4) return (fetchUrl, m.sel.homeQ2);
            if (field == 5) return (fetchUrl, m.sel.awayQ1);
            if (field == 6) return (fetchUrl, m.sel.awayQ2);
        }
        return ("", "");
    }

    function _fetchFieldCount(Sport sport) internal pure returns (uint8) {
        if (sport == Sport.Soccer) return 8;
        if (sport == Sport.MLB) return 2;
        return 6;
    }

    function _requiredFetchMask(Sport sport) internal pure returns (uint16) {
        uint8 n = _fetchFieldCount(sport);
        if (n >= 16) return type(uint16).max;
        return uint16((1 << n) - 1);
    }

    function _abortSettleFetch(Match storage m, uint256 matchId, uint8 field) internal {
        _abortSettleFetch(m, matchId, field, ResponseStatus.Failed);
    }

    function _abortSettleFetch(Match storage m, uint256 matchId, uint8 field, ResponseStatus status) internal {
        m.settleInProgress = false;
        m.fetchMask = 0;
        m.state = MatchState.LOCKED;
        emit MatchSettleFetchFailed(matchId, field, status);
        _scheduleSettleRetry(matchId, field, status);
    }

    function _finalizeSettlement(uint256 matchId, Match storage m) internal {
        PlayscriptV2Grading.Facts memory facts = PlayscriptV2Grading.Facts({
            finalHome: m.finalHome,
            finalAway: m.finalAway,
            htHome: m.htHome,
            htAway: m.htAway,
            yellowHome: m.yellowHome,
            yellowAway: m.yellowAway,
            redHome: m.redHome,
            redAway: m.redAway,
            homeQ1: m.homeQ1,
            homeQ2: m.homeQ2,
            awayQ1: m.awayQ1,
            awayQ2: m.awayQ2
        });
        m.resolvedLegsBitmask = PlayscriptV2Grading.resolveMask(uint8(m.sport), m.legKinds, facts);

        address vAddr = vault;
        uint256 cap = m.matchLiabilityCap;
        if (vAddr != address(0) && cap > 0) {
            IPlayVault(vAddr).clearLiability(cap);
        }
        m.settled = true;
        m.settleInProgress = false;
        m.state = MatchState.SETTLED;
        emit MatchSettled(matchId, m.finalHome, m.finalAway, m.resolvedLegsBitmask);
    }

    function _scheduleSettleRetry(uint256 matchId, uint8 field, ResponseStatus status) internal {
        Match storage m = _matches[matchId];
        if (m.settled) return;

        uint64 retryAt = uint64(block.timestamp) + uint64(settleRetryDelaySec);
        if (retryAt <= m.kickoff) revert BadTime();

        uint32 newFinalizeDelay = uint32(uint256(retryAt) - uint256(m.kickoff));
        m.finalizeDelaySec = newFinalizeDelay;

        address sched = scheduler;
        if (sched == address(0)) return;

        IPlayscriptScheduler(sched).scheduleSettleRetry(matchId, retryAt);
        emit SettleRetryScheduled(matchId, newFinalizeDelay, retryAt, field, status);
    }

    function _validateWeights(uint8[12] calldata w) internal pure {
        unchecked {
            for (uint256 i; i < 12; ++i) {
                uint8 x = w[i];
                if (x != 10 && x != 15 && x != 25) revert BadWeights();
            }
        }
    }
}
