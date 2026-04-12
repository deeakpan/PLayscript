/** Narrow ABI for client reads — keep aligned with `contracts/PlayscriptCore.sol` / `PlayToken.sol`. */

export const playTokenReadAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const playTokenWriteAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export const playscriptCoreWriteAbi = [
  {
    type: "function",
    name: "lockScript",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "picksPacked", type: "uint256" },
      { name: "stake", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const playscriptCoreReadAbi = [
  {
    type: "function",
    name: "nextMatchId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "nextScriptId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getScript",
    stateMutability: "view",
    inputs: [{ name: "scriptId", type: "uint256" }],
    outputs: [
      {
        name: "s",
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "matchId", type: "uint256" },
          { name: "stake", type: "uint256" },
          { name: "picksPacked", type: "uint256" },
          { name: "choicesReceipt", type: "bytes32" },
          { name: "claimed", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "matches_",
    stateMutability: "view",
    /** Must match `artifacts/.../PlayscriptCore.json` — `Selectors` is one `tuple`, not five loose strings. */
    inputs: [{ name: "matchId", type: "uint256" }],
    outputs: [
      { name: "sport", type: "uint8" },
      { name: "kickoff", type: "uint64" },
      { name: "finalizeDelaySec", type: "uint32" },
      { name: "url", type: "string" },
      {
        name: "sel",
        type: "tuple",
        components: [
          { name: "homeScore", type: "string" },
          { name: "awayScore", type: "string" },
          { name: "status", type: "string" },
          { name: "homeTeam", type: "string" },
          { name: "awayTeam", type: "string" },
        ],
      },
      { name: "exists", type: "bool" },
      { name: "settled", type: "bool" },
      { name: "settleInProgress", type: "bool" },
      { name: "fetchMask", type: "uint8" },
      { name: "finalHome", type: "uint256" },
      { name: "finalAway", type: "uint256" },
    ],
  },
] as const;
