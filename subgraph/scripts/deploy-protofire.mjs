#!/usr/bin/env node
/**
 * Protofire / Chain.Love hosted subgraph on Somnia.
 *
 * 1. Open https://somnia.chain.love/ → create subgraph (name must match deploy target below).
 * 2. Copy deploy access token → CHAIN_LOVE_ACCESS_TOKEN in repo root `.env`.
 * 3. npm run deploy:protofire
 *
 * Query URL (after sync):
 *   https://proxy.somnia.chain.love/subgraphs/name/somnia-testnet/playscript-v2-somnia
 */
import { buildSubgraph, graphDeploy, loadEnvVar } from "./deploy-shared.mjs";

const subgraphName = process.env.PROTOFIRE_SUBGRAPH_NAME ?? "somnia-testnet/playscript-v2-somnia";
const versionLabel = process.env.SUBGRAPH_VERSION ?? "v0.0.2";

const token = loadEnvVar("CHAIN_LOVE_ACCESS_TOKEN");

buildSubgraph(versionLabel);

graphDeploy({
  deployTarget: subgraphName,
  versionLabel,
  node: "https://proxy.somnia.chain.love/graph/somnia-testnet",
  ipfs: null,
  authFlag: "--access-token",
  authValue: token,
});

console.log(
  "\nProtofire deploy finished. Set in repo root .env:\n" +
    `NEXT_PUBLIC_PLAYSCRIPT_V2_SUBGRAPH_URL=https://proxy.somnia.chain.love/subgraphs/name/${subgraphName}\n` +
    "Confirm sync on https://somnia.chain.love/ before using My Scripts.",
);
