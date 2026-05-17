#!/usr/bin/env node
/** Deploy to Somnia hosted subgraph using SUBGRAPH_API_KEY from repo root `.env`. */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const envPath = path.join(root, ".env");
const subgraphSlug = "playscript-v2-somnia-v0-0-1";
const versionLabel = "v0.0.1";

function loadDeployKey() {
  if (!fs.existsSync(envPath)) {
    throw new Error("Missing .env at repo root");
  }
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*SUBGRAPH_API_KEY\s*=\s*(.+?)\s*$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("SUBGRAPH_API_KEY not set in .env");
}

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args[0]} failed (exit ${r.status})`);
  }
}

const deployKey = loadDeployKey();
const subgraphDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log(`Building subgraph ${versionLabel}…`);
run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], subgraphDir);

console.log(`Deploying ${subgraphSlug} (${versionLabel}) to Somnia…`);
run(
  process.platform === "win32" ? "npx.cmd" : "npx",
  [
    "graph",
    "deploy",
    subgraphSlug,
    "--node",
    "https://api.subgraph.somnia.network/deploy",
    "--ipfs",
    "https://api.subgraph.somnia.network/ipfs",
    "--deploy-key",
    deployKey,
    "--version-label",
    versionLabel,
  ],
  subgraphDir,
);

const queryBase = "https://api.subgraph.somnia.network";
console.log(
  "\nIf deploy succeeded, set in repo root .env:\n" +
    `NEXT_PUBLIC_PLAYSCRIPT_V2_SUBGRAPH_URL=${queryBase}<Queries path from graph deploy output>\n` +
    "Example shape: .../api/public/<uuid>/subgraphs/playscript-v2-somnia-v0-0-1/v0.0.1/gn",
);
