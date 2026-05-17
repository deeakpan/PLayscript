/** Read ABI for `PlayscriptV2LockRegistry` — keep aligned with `contracts/v2/PlayscriptV2LockRegistry.sol`. */

export const playscriptV2LockRegistryReadAbi = [
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "userLockCount",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getUserLocks",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      { name: "lockIds", type: "uint256[]" },
      { name: "matchIds", type: "uint256[]" },
      { name: "legMask12s", type: "uint16[]" },
      { name: "actualStakes", type: "uint256[]" },
      { name: "netStakes", type: "uint256[]" },
      { name: "payoutRates", type: "uint256[]" },
      { name: "blockNumbers", type: "uint64[]" },
      { name: "claimedFlags", type: "bool[]" },
    ],
  },
  {
    type: "function",
    name: "isOutcomeClaimed",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "matchId", type: "uint256" },
      { name: "legMask12", type: "uint16" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;
