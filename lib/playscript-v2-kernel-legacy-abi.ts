/** Pre-ESPN `PlayscriptKernel.matches` — keep for kernels deployed before struct expansion. */

export const playscriptKernelLegacyReadAbi = [
  {
    type: "function",
    name: "nextMatchId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "matches",
    stateMutability: "view",
    inputs: [{ name: "matchId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
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
          { name: "state", type: "uint8" },
          { name: "legWeights", type: "uint8[12]" },
          { name: "exists", type: "bool" },
          { name: "settled", type: "bool" },
          { name: "settleInProgress", type: "bool" },
          { name: "fetchMask", type: "uint8" },
          { name: "finalHome", type: "uint256" },
          { name: "finalAway", type: "uint256" },
          { name: "resolvedLegsBitmask", type: "uint16" },
          { name: "matchLiabilityCap", type: "uint256" },
          { name: "matchLiability", type: "uint256" },
        ],
      },
    ],
  },
] as const;
