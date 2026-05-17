#!/usr/bin/env node
/** Copy full contract ABIs from Hardhat artifacts into `subgraph/abis/` (optional; minimal ABIs are committed). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "abis");

const pairs = [
  ["PlayscriptKernel", "PlayscriptKernel.json"],
  ["PlayscriptV2Positions", "PlayscriptV2Positions.json"],
];

for (const [name, file] of pairs) {
  const src = path.join(root, "artifacts", "contracts", "v2", `${name}.sol`, `${name}.json`);
  if (!fs.existsSync(src)) {
    console.warn(`skip ${name}: run \`npx hardhat compile\` first (${src})`);
    continue;
  }
  const artifact = JSON.parse(fs.readFileSync(src, "utf8"));
  const abi = artifact.abi.filter((item) => item.type === "event");
  for (const item of abi) {
    if (item.type === "event" && item.anonymous === undefined) {
      item.anonymous = false;
    }
  }
  fs.writeFileSync(path.join(outDir, file), JSON.stringify(abi, null, 2));
  console.log("wrote", file);
}
