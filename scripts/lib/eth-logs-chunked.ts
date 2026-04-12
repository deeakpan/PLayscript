/**
 * Somnia HTTP RPC rejects `eth_getLogs` when the block span is too large (e.g. "block range exceeds 1000").
 * Use as max (toBlock - fromBlock) per query (inclusive block count = span + 1 ≤ 999).
 */
export const DEFAULT_GETLOGS_BLOCK_SPAN = 998n;
