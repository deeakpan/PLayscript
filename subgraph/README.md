# Playscript v2 subgraph

Indexes **v2** on-chain script activity on Somnia testnet for the **My Scripts** page:

| Contract | Events |
|----------|--------|
| `PlayscriptKernel` | `MatchRegistered`, `MatchSettled`, `ScriptPaid` |
| `PlayscriptV2Positions` | `ScriptLocked`, `ScriptClaimed`, `TransferSingle` (unwinds) |

Network slug in `subgraph.yaml`: **`somnia-testnet`** (see `graphNetwork` in `deployments/playscript-v2-somnia.json`). Hardhat deploys use network key **`somnia`** — same chain, different names.

Addresses and start blocks match the deployment file. Update `subgraph.yaml` and `networks.json` after a new deploy.

## Setup

```bash
cd subgraph
npm install
npm run build
```

Optional: refresh ABIs from Hardhat artifacts:

```bash
npm run sync-abis   # from repo root: npx hardhat compile first
```

## Ormi hosted subgraph (`subgraph.somnia.network`)

Deploy key from [Ormi dashboard](https://subgraph.somnia.network/) → `SUBGRAPH_API_KEY` in repo root `.env`.

Default: slug `playscript-v2-somnia-v0-0-1`, version **`v0.0.2`** (override with `SUBGRAPH_VERSION`).

```bash
cd subgraph
npm run deploy:somnia
```

Copy the **Queries** URL from CLI output into:

```env
NEXT_PUBLIC_PLAYSCRIPT_V2_SUBGRAPH_URL=https://api.subgraph.somnia.network/api/public/.../gn
```

If `latest_block` stays empty on the dashboard, try Protofire below or open an Ormi support ticket.

## Protofire / Chain.Love (`somnia.chain.love`)

Separate host — often worth trying when Ormi never leaves block 0.

1. [somnia.chain.love](https://somnia.chain.love/) → create subgraph named **`playscript-v2-somnia`** (network `somnia-testnet`).
2. Copy deploy **access token** → `CHAIN_LOVE_ACCESS_TOKEN` in repo root `.env`.
3. Deploy:

```bash
cd subgraph
npm run deploy:protofire
```

Query URL (after sync):

```env
NEXT_PUBLIC_PLAYSCRIPT_V2_SUBGRAPH_URL=https://proxy.somnia.chain.love/subgraphs/name/somnia-testnet/playscript-v2-somnia
```

Override name with `PROTOFIRE_SUBGRAPH_NAME=somnia-testnet/your-name` if needed.

Manifest network must stay **`somnia-testnet`** — that must match what Somnia’s indexer expects.

## Local graph node (optional dev)

Run [Graph Node](https://github.com/graphprotocol/graph-node) + IPFS pointed at Somnia RPC (`chainId` **50312**). The manifest network slug is **`somnia-testnet`** (not Hardhat’s `somnia`). Add to `graph-node/config.toml`:

```toml
[chains.somnia-testnet]
shard = "primary"
provider = [
  { label = "somnia", url = "https://api.infra.testnet.somnia.network", features = [] }
]
```

```toml
[chains.somnia-testnet.ingestor]
block_polling_interval = 1000
```

Then:

```bash
npm run create-local
npm run deploy-local
```

Query UI: `http://localhost:8000/subgraphs/name/playscript-v2-somnia`

## Example GraphQL

**Locks for a wallet** (newest first):

```graphql
query UserScriptLocks($user: ID!) {
  user(id: $user) {
    locks(orderBy: blockTimestamp, orderDirection: desc, first: 50) {
      id
      matchId
      legMask12
      netStake
      actualStake
      payoutRate
      blockTimestamp
      transactionHash
      match {
        url
        settled
        sport
        kickoff
      }
    }
    claims(orderBy: blockTimestamp, orderDirection: desc, first: 50) {
      matchId
      legMask12
      netStakeBurned
      payout
      blockTimestamp
    }
  }
}
```

Variables: `{ "user": "0xabc...def" }` (lowercase hex).

## App integration

Set in `.env`:

```env
NEXT_PUBLIC_PLAYSCRIPT_V2_SUBGRAPH_URL=http://localhost:8000/subgraphs/name/playscript-v2-somnia
```

The Next.js app reads this in `usePlayscriptV2UserScripts` and shows v2 lock history on **My Scripts** when configured.
