/** Narrow ABI for `PlayscriptV2Positions` — keep aligned with `contracts/v2/PlayscriptV2Positions.sol`. */

export const playscriptV2PositionsReadAbi = [
  {
    type: "function",
    name: "kernel",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "playToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "vault",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "scriptTokenId",
    stateMutability: "pure",
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "legMask12", type: "uint16" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const playscriptV2PositionsWriteAbi = [
  {
    type: "function",
    name: "lockScript",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "legMask12", type: "uint16" },
      { name: "playAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "unwind",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "legMask12", type: "uint16" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "legMask12", type: "uint16" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;
