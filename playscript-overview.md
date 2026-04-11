# Playscript — Protocol Overview

> *Script special moments on your favorite sports*

---

## What It Is

A decentralized sports scenario market where users script multiple outcomes for a real match before kickoff, stake on their script, and get paid based on how accurately their script matches what actually happened. Settled trustlessly via Somnia Agents fetching TheSportsDB — no human referee, no house, no bookie.

---

## Core Entities

```
Match       → a registered real world fixture with event ID, teams, kickoff time
Script      → a user's set of slot predictions for a specific match
Slot        → a single prediction within a script
Settlement  → Agent fetch + grading + mint payout
```

---

## Match Registration

Admin calls `registerMatch()` before kickoff passing:
- TheSportsDB event ID
- Home team name
- Away team name
- Kickoff timestamp (UTC from `strTimestamp`)
- League name

Contract stores match, sets status to `OPEN`. Frontend pulls upcoming fixtures directly from TheSportsDB and displays them to users.

---

## Script Building — User Flow

User picks a match then fills 5 slots:

```
Slot 1 — Match Winner      → Home / Draw / Away
Slot 2 — Total Goals       → Over 2.5 / Under 2.5
Slot 3 — Both Teams Score  → Yes / No
Slot 4 — Clean Sheet       → Yes / No
Slot 5 — Correct Score     → e.g. 2-1 (home + away exact score)
```

Each slot stored as a generic `slotType` + `value` pair so any sport can plug in.

User stakes USDC and calls `lockScript()`. Script is immutable after this.

A script hash is generated from all 5 slot values:

```solidity
bytes32 scriptHash = keccak256(abi.encode(slot1, slot2, slot3, slot4, slot5));
```

**Shared Scripts:** Any user can submit the same hash while the match is still `OPEN` — they join the same script position. Frontend shows "X others scripted this exact scenario." This is a social layer built into the architecture for free.

---

## Before Kickoff

- Match status: `OPEN`
- Users submit scripts and stakes
- Frontend shows live count of scripts and total staked
- No scripts accepted after kickoff timestamp

---

## Settlement Trigger

Somnia cron fires at `kickoffTimestamp + 7200` (kickoff + 120 mins). Calls `settleMatch()` automatically. No keeper, no manual call needed. By 120 mins the match is always finished regardless of stoppage time.

---

## Agent Fetches — 4 calls per settlement

All calls hit TheSportsDB free tier — no API key, no headers, no middleware.

```
1. fetchUint   → intHomeScore
   url: thesportsdb.com/api/v1/json/3/eventslast.php?id={eventId}
   selector: results[0].intHomeScore

2. fetchUint   → intAwayScore
   url: thesportsdb.com/api/v1/json/3/eventslast.php?id={eventId}
   selector: results[0].intAwayScore

3. fetchString → strStatus (confirm match finished)
   url: thesportsdb.com/api/v1/json/3/eventslast.php?id={eventId}
   selector: results[0].strStatus

4. fetchString → strHomeTeam (string verification)
   url: thesportsdb.com/api/v1/json/3/eventslast.php?id={eventId}
   selector: results[0].strHomeTeam
```

All 4 results return via Agent callbacks. Contract waits for all before grading.

---

## Grading Logic

From home score and away score the contract derives all slot results:

```
Match Winner:
  homeScore > awayScore  → Home
  homeScore < awayScore  → Away
  homeScore == awayScore → Draw

Total Goals:
  homeScore + awayScore > 2  → Over 2.5
  homeScore + awayScore <= 2 → Under 2.5

Both Teams Score:
  homeScore > 0 && awayScore > 0 → Yes
  else → No

Clean Sheet:
  awayScore == 0  → Yes (home clean sheet)
  homeScore == 0  → Yes (away clean sheet)
  both > 0        → No

Correct Score:
  homeScore == userHomePick && awayScore == userAwayPick → correct
```

Each user's 5 slots graded. Accuracy score:
```
accuracyScore = correctSlots / 5
```

---

## Win / Loss Cutoff

```
3/5 and above → Winner
Below 3/5     → Loser → loses stake
```

---

## Payout Mechanic — Mint Based on Stake + Accuracy

No pool splitting. Winners receive minted tokens based on their stake and accuracy score.

**Payout formula:**

```
Base multiplier per accuracy tier:
  5/5 → 3.0x
  4/5 → 1.8x
  3/5 → 1.2x

Payout = userStake × multiplier
```

**Example:**

| User | Stake | Correct | Multiplier | Payout |
|------|-------|---------|------------|--------|
| A    | $100  | 5/5     | 3.0x       | $300   |
| B    | $50   | 4/5     | 1.8x       | $90    |
| C    | $200  | 3/5     | 1.2x       | $240   |
| D    | $75   | 2/5     | 0x         | $0     |
| E    | $100  | 1/5     | 0x         | $0     |

Protocol mints payout tokens to winners. Losers forfeit their stake to protocol treasury. Treasury funds future mints and protocol operations.

**5% protocol fee taken from all payouts before distribution.**

---

## String Comparison

All string comparisons use keccak256 hash of lowercase to handle API casing differences:

```solidity
keccak256(bytes(toLower(result))) == keccak256(bytes(toLower(userPick)))
```

"Liverpool" == "liverpool" — always matches correctly.

---

## Frontend Live Tracking

During match frontend polls TheSportsDB directly every 15 seconds — not through Agent, just regular API calls. Shows live slot status as the match progresses. Purely cosmetic, no onchain activity until settlement.

```
✅ Match Winner     — Home (Liverpool leading 2-0)
✅ Total Goals      — Over 2.5 (3 goals scored)
⏳ Both Teams Score — pending
⏳ Clean Sheet      — pending
❌ Correct Score    — 2-1 (currently 2-0)
```

---

## Multi-Sport

Same architecture works for any sport TheSportsDB supports. Each sport has its own slot type definitions. New sport = new `registerMatch` with different league ID, same contract handles it.

Supported sports via TheSportsDB free tier:
- Football (Soccer)
- Basketball
- American Football (NFL)
- MMA
- Cricket
- Rugby

---

## Tech Stack

```
Chain         → Somnia Mainnet / Testnet
Oracle        → Somnia Agent + TheSportsDB free tier (no auth)
Automation    → Somnia cron subscriptions (kickoff + 7200s)
Settlement    → Agent callback → contract grades → mint payout
Token         → ERC20 mock for testnet, real token on mainnet
No DEX        → no swap needed, pure USDC in / payout token out
No lending    → zero external protocol dependency
```

---

## What Makes It Different From Sportybet

| Feature | Sportybet | Playscript |
|---------|-----------|------------|
| Partial payout | No — all or nothing | Yes — 3/5 still pays |
| Custody | Centralized | Non-custodial |
| Settlement | Human/bookie | Agent + smart contract |
| Odds | House sets them | Fixed multiplier tiers |
| Transparency | None | Fully onchain |
| Shared tickets | Via code | Via script hash onchain |
| House | Always wins | No house |

---

## Contract Functions (High Level)

```
registerMatch(eventId, homeTeam, awayTeam, kickoffTimestamp, league)
lockScript(matchId, slots[], stake)
submitHash(matchId, scriptHash, stake)   ← join existing script
settleMatch(matchId)                      ← called by cron
claimPayout(matchId)                      ← winner claims after settlement
```

---

## Tagline

> *Script special moments on your favorite sports*
