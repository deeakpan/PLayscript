#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const envPath = path.join(root, ".env");
const subgraphDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export function loadEnvVar(name) {
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing .env at repo root (${envPath})`);
  }
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error(`${name} not set in .env`);
}

export function run(cmd, args, cwd = subgraphDir) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args[0]} failed (exit ${r.status})`);
  }
}

export function buildSubgraph(versionLabel) {
  console.log(`Building subgraph (${versionLabel})…`);
  run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"]);
}

export function graphDeploy({ deployTarget, versionLabel, node, ipfs, authFlag, authValue, extraArgs = [] }) {
  const args = ["graph", "deploy", deployTarget];
  if (ipfs) args.push("--ipfs", ipfs);
  args.push("--node", node, "--version-label", versionLabel, authFlag, authValue, ...extraArgs);
  console.log(`Deploying ${deployTarget} (${versionLabel})…`);
  run(process.platform === "win32" ? "npx.cmd" : "npx", args);
}
