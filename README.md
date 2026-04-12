# Playscript

Playscript matches **on-chain sports scenarios** to **TheSportsDB**: each match stores the same JSON `lookupevent.php?id=…` URL you use in the app, plus a **sport** (soccer, basketball, NFL, MLB) so five-slot scripts grade with the right rules. Users lock **PLAY** and a packed pick vector before kickoff; after the match window, settlement pulls **live scores from that URL** through Somnia’s **JSON API agent**, then scripts grade against the finals.

---

## 1. Match data the agent reads

Registration stores the event URL and **selector strings** (paths into the TheSportsDB JSON—for example `events[0].intHomeScore`). Those are *not* display names; they tell the agent which fields to return as `uint256` (scores) or `string` (status / team labels for sanity checks).

---

## 2. Where the agent is invoked

Anyone can call **`settleMatch`** after kickoff plus the finalize delay, paying **five times** the platform’s per-request deposit. The contract opens five parallel agent requests (home score, away score, status, home team string, away team string). The platform calls back into **`handleSettleFetch`** with each response; when all five succeed, **`fetchMask`** is full, **`finalHome` / `finalAway`** are set, and the match is **`settled`**.

---

## 3. Solidity — agent wiring (excerpts from `PlayscriptCore.sol`)

Platform address and JSON API agent id used for every settle fetch:

```solidity
IAgentRequester public constant PLATFORM =
    IAgentRequester(0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776);

uint256 public constant JSON_API_AGENT_ID = 13174292974160097713;
```

Starting settlement: time gate, native deposit (**5×** single request deposit), then five internal requests:

```solidity
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
```

Each field: **`fetchUint`** for the two scores (against `m.url` + selector), **`fetchString`** for status and the two team selectors. **`createRequest`** targets this contract’s **`handleSettleFetch`** callback.

```solidity
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
```

Callback (only **`PLATFORM`**): decode results, set **`finalHome` / `finalAway`**, advance **`fetchMask`**; on full mask, mark **`settled`**. Any failure clears progress and emits **`MatchSettleFetchFailed`**.

```solidity
function handleSettleFetch(
    uint256 requestId,
    Response[] memory responses,
    ResponseStatus status,
    Request memory
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
```

---

## 4. After settlement

**`claimPayout`** runs **`_grade`** using **`m.sport`**, the user’s **`picksPacked`**, and **`finalHome` / `finalAway`**. Payout math and treasury transfer are entirely on-chain once those finals exist.

In short: **TheSportsDB** supplies the document and field paths; **sport** chooses grading rules; **Somnia agents** supply the trusted numeric finals that settlement and claims depend on.
