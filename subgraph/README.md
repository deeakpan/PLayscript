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

## Somnia hosted subgraph (recommended)

If you have a deploy key from [Somnia’s subgraph dashboard](https://docs.somnia.network) (or their team), deploy from `subgraph/`:

**Version `v0.0.1`** — subgraph slug `playscript-v2-somnia-v0-0-1`.

From repo root, put `SUBGRAPH_API_KEY=…` in `.env`, then:

```bash
cd subgraph
npm run deploy:somnia
```

This runs `npm run build` then deploys with `--version-label v0.0.1` (reads the key from `.env`; do not commit it).

After deploy, the dashboard gives you a **query URL** (GraphQL). Put that in the app:

```env
NEXT_PUBLIC_PLAYSCRIPT_V2_SUBGRAPH_URL=https://…  # query endpoint, not the /deploy URL
```

Use subgraph slug **`playscript-v2-somnia`** only if that name is free on your account; otherwise replace it with the slug you registered (e.g. `your-team/playscript-v2`).

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
