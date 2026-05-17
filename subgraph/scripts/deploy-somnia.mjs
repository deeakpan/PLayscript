#!/usr/bin/env node
/** Deploy to Ormi (api.subgraph.somnia.network). Uses SUBGRAPH_API_KEY in repo root `.env`. */
import { buildSubgraph, graphDeploy, loadEnvVar } from "./deploy-shared.mjs";

// Fresh slug avoids Ormi stalling the same deployment id (QmY5…); override via ORMI_SUBGRAPH_SLUG.
const subgraphSlug = process.env.ORMI_SUBGRAPH_SLUG ?? "playscript-v2-somnia-v0-0-2";
const versionLabel = process.env.SUBGRAPH_VERSION ?? "v0.0.2";

const deployKey = loadEnvVar("SUBGRAPH_API_KEY");

buildSubgraph(versionLabel);

graphDeploy({
  deployTarget: subgraphSlug,
  versionLabel,
  node: "https://api.subgraph.somnia.network/deploy",
  ipfs: "https://api.subgraph.somnia.network/ipfs",
  authFlag: "--deploy-key",
  authValue: deployKey,
});

console.log(
  "\nOrmi deploy finished. Copy the **Queries** URL from the CLI output into .env:\n" +
    "NEXT_PUBLIC_PLAYSCRIPT_V2_SUBGRAPH_URL=https://api.subgraph.somnia.network/api/public/<uuid>/subgraphs/" +
    `${subgraphSlug}/${versionLabel}/gn\n` +
    "Dashboard: https://subgraph.somnia.network/",
);
