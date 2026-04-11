# Playscript — Somnia Agents notes

Living doc for **Somnia Agents** issues and fixes. Add sections as you discover more.

---

## Wrong `AgentRequester` platform address (`not enough active members`)

**Symptom:** Solidity `createRequest` / `createAdvancedRequest` reverted with:

`AgentRequester: not enough active members`

**What we assumed at first:** Somnia testnet had too few active validators; we tried smaller subcommittees via `createAdvancedRequest`.

**Actual cause:** We were calling the **platform contract from older Metaversal GitBook docs** (`0x7407cb35a17D511D1Bd32dD726ADb8D5344ECbE3`). **Somnia Agent Monitor** and working txs use the **current** `AgentRequester` on Somnia testnet:

`0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776`

**How we verified:** A successful Agent Monitor tx used selector `0x8bbcbbe2` (= `createRequest(uint256,address,bytes4,bytes)`) **to** `0x037Bb9…`, same agent id and deposit pattern as our code.

**Fix:** Set `PLATFORM` in `contracts/PriceOracle.sol` and `contracts/JsonApiProbe.sol` to `0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776`, and use **`getRequestDeposit()` + `createRequest`** to match that flow. See comment in `contracts/interfaces/ISomniaAgents.sol`.

**Lesson:** Treat GitBook addresses as **version-specific**; confirm **`to`** on a known-good tx (explorer / Agent Monitor) before hardcoding.

---

## Reference — working price oracle invoke (example)

After deploy with correct `PLATFORM` and oracle address in `.env`:

```text
npm run invoke:price-oracle -- --network somnia
```

Example success: `PriceReceived` with BTC/USD from CoinGecko (8-decimal fixed-point in `latestPrice`).

---

## Contracts (agents)

| Contract | Role |
|----------|------|
| `contracts/PriceOracle.sol` | Somnia JSON API agent — BTC/ETH/`requestPrice` |
| `contracts/JsonApiProbe.sol` | Demos + TheSportsDB multi-field probe |
| `contracts/interfaces/ISomniaAgents.sol` | `IAgentRequester` + types + `IJsonApiAgent` |
| `scripts/invoke-price-oracle.ts` | Calls `requestBtcPrice`, polls `PriceReceived` |
