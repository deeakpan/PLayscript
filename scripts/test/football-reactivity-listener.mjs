#!/usr/bin/env node
/**
 * Somnia off-chain reactivity: WebSocket subscription to `FootballTest` events (push, no HTTP log polling).
 *
 * Prereqs: `npm install` (includes `@somnia-chain/reactivity`; use `npm install --legacy-peer-deps` if npm complains about viem peers).
 *
 * `.env`:
 *   FOOTBALL_TEST_ADDRESS=0x...   (deployed FootballTest)
 * Optional:
 *   FOOTBALL_WATCH_SCRIPT_ID=0    (only print events for this scriptId; omit = print all)
 *   SOMNIA_WS_URL=wss://...       (default: testnet infra WS)
 *   FOOTBALL_REACTIVITY_TOPICS=1  (narrow subscription to ScriptSettled + FootballFetchFailed topic0)
 *
 * Run: `npm run listen:football-reactivity`
 */

import "dotenv/config";
import { SDK } from "@somnia-chain/reactivity";
import {
  createPublicClient,
  decodeEventLog,
  defineChain,
  getAddress,
  isAddress,
  parseAbi,
  parseAbiItem,
  toEventSelector,
  webSocket,
} from "viem";

const WS_DEFAULT = "wss://api.infra.testnet.somnia.network/ws";

const footballAbi = parseAbi([
  "event ScriptSettled(uint256 indexed scriptId, uint8 correctSlots, uint256 payoutPlay, uint256 homeScore, uint256 awayScore, string status)",
  "event FootballFetchFailed(uint256 indexed scriptId, uint8 field, uint8 status)",
  "event ScriptLocked(uint256 indexed scriptId, uint256 indexed matchId, address owner, uint256 playAmount)",
  "event MatchRegistered(uint256 indexed matchId, string url)",
]);

const topicScriptSettled = toEventSelector(
  parseAbiItem(
    "event ScriptSettled(uint256 indexed scriptId, uint8 correctSlots, uint256 payoutPlay, uint256 homeScore, uint256 awayScore, string status)",
  ),
);
const topicFootballFetchFailed = toEventSelector(
  parseAbiItem("event FootballFetchFailed(uint256 indexed scriptId, uint8 field, uint8 status)"),
);

function parseContractAddress() {
  const raw = process.env.FOOTBALL_TEST_ADDRESS?.trim().replace(/^["']|["']$/g, "") ?? "";
  if (!raw || !isAddress(raw)) {
    throw new Error("Set FOOTBALL_TEST_ADDRESS in .env (checksummed 0x + 40 hex).");
  }
  return getAddress(raw);
}

const somniaTestnet = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { decimals: 18, name: "Somnia Test Token", symbol: "STT" },
  rpcUrls: {
    default: {
      http: ["https://api.infra.testnet.somnia.network"],
      webSocket: [process.env.SOMNIA_WS_URL?.trim() || WS_DEFAULT],
    },
  },
  blockExplorers: {
    default: { name: "Somnia Shannon Explorer", url: "https://shannon-explorer.somnia.network" },
  },
});

const wsUrl = process.env.SOMNIA_WS_URL?.trim() || WS_DEFAULT;

const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: webSocket(wsUrl),
});

const sdk = new SDK({ public: publicClient });

const watchScriptIdRaw = process.env.FOOTBALL_WATCH_SCRIPT_ID?.trim();
const watchScriptId =
  watchScriptIdRaw !== undefined && watchScriptIdRaw !== "" ? BigInt(watchScriptIdRaw) : null;

const useNarrowTopics = process.env.FOOTBALL_REACTIVITY_TOPICS === "1";

function matchesScriptFilter(decoded) {
  if (watchScriptId === null) return true;
  if (decoded.eventName === "MatchRegistered") return false;
  const sid = decoded.args?.scriptId;
  return sid !== undefined && BigInt(sid) === watchScriptId;
}

async function main() {
  const contract = parseContractAddress();

  console.log("FootballTest reactivity listener");
  console.log("  contract:", contract);
  console.log("  ws:", wsUrl);
  if (watchScriptId !== null) console.log("  scriptId filter:", watchScriptId.toString());
  console.log("  topic filter:", useNarrowTopics ? "ScriptSettled | FootballFetchFailed" : "all events from contract");
  console.log("");

  const sub = await sdk.subscribe({
    ethCalls: [],
    eventContractSources: [contract],
    topicOverrides: useNarrowTopics ? [topicScriptSettled, topicFootballFetchFailed] : undefined,
    onlyPushChanges: false,
    onData: (data) => {
      try {
        const { topics, data: hexData } = data.result;
        const decoded = decodeEventLog({
          abi: footballAbi,
          topics,
          data: hexData,
        });
        if (!matchesScriptFilter(decoded)) return;

        const name = decoded.eventName;
        const args = decoded.args ?? {};
        console.log(new Date().toISOString(), name, args);
      } catch {
        // Other events from same contract — ignore decode errors
      }
    },
    onError: (err) => {
      console.error("Subscription error:", err?.message ?? err);
    },
  });

  if (sub instanceof Error) {
    console.error("Failed to subscribe:", sub.message);
    process.exit(1);
  }

  console.log("Subscribed (somnia_watch). Ctrl+C to exit.");
  if (sub && typeof sub === "object" && "subscriptionId" in sub) {
    console.log("  subscriptionId:", sub.subscriptionId);
  }

  const shutdown = async () => {
    try {
      if (typeof sub.unsubscribe === "function") await sub.unsubscribe();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
