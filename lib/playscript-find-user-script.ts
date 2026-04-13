import { getAddress, isAddress, zeroAddress } from "viem";

import { createSomniaPublicClient } from "@/lib/playscript-read-onchain";
import { playscriptCoreReadAbi } from "@/lib/playscript-onchain-abi";

export type OnChainScriptRow = {
  owner: `0x${string}`;
  matchId: bigint;
  stake: bigint;
  picksPacked: bigint;
  choicesReceipt: `0x${string}`;
  claimed: boolean;
};

function normalizeScript(raw: unknown): OnChainScriptRow | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const [owner, matchId, stake, picksPacked, choicesReceipt, claimed] = raw;
    return normalizeScript({
      owner,
      matchId,
      stake,
      picksPacked,
      choicesReceipt,
      claimed,
    });
  }
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const owner = o.owner;
  if (typeof owner !== "string" || !isAddress(owner)) return null;
  if (getAddress(owner as `0x${string}`) === zeroAddress) return null;
  const matchId = o.matchId;
  const stake = o.stake;
  const picksPacked = o.picksPacked;
  const choicesReceipt = o.choicesReceipt;
  const claimed = o.claimed;
  if (typeof matchId !== "bigint" || typeof stake !== "bigint" || typeof picksPacked !== "bigint") {
    return null;
  }
  if (typeof choicesReceipt !== "string") return null;
  return {
    owner: getAddress(owner as `0x${string}`),
    matchId,
    stake,
    picksPacked,
    choicesReceipt: choicesReceipt as `0x${string}`,
    claimed: Boolean(claimed),
  };
}

/**
 * Linear scan of `getScript(0..next-1)` for `owner` + `matchId`.
 * Fine for modest `nextScriptId`; revisit if the index grows very large.
 */
export async function findUserScriptForMatch(
  coreAddress: `0x${string}`,
  owner: `0x${string}`,
  matchId: bigint,
): Promise<{ scriptId: bigint; script: OnChainScriptRow } | null> {
  const client = createSomniaPublicClient();
  const ownerLc = getAddress(owner).toLowerCase();

  const next = await client.readContract({
    address: coreAddress,
    abi: playscriptCoreReadAbi,
    functionName: "nextScriptId",
  });
  const n = BigInt(next);

  for (let i = BigInt(0); i < n; i += BigInt(1)) {
    const raw = await client.readContract({
      address: coreAddress,
      abi: playscriptCoreReadAbi,
      functionName: "getScript",
      args: [i],
    });
    const script = normalizeScript(raw);
    if (!script) continue;
    if (script.matchId !== matchId) continue;
    if (getAddress(script.owner).toLowerCase() !== ownerLc) continue;
    return { scriptId: i, script };
  }

  return null;
}

/** Newest script first (descending `scriptId`). */
export async function findAllUserScriptsForOwner(
  coreAddress: `0x${string}`,
  owner: `0x${string}`,
): Promise<{ scriptId: bigint; script: OnChainScriptRow }[]> {
  const client = createSomniaPublicClient();
  const ownerLc = getAddress(owner).toLowerCase();

  const next = await client.readContract({
    address: coreAddress,
    abi: playscriptCoreReadAbi,
    functionName: "nextScriptId",
  });
  const n = BigInt(next);

  const out: { scriptId: bigint; script: OnChainScriptRow }[] = [];
  for (let i = BigInt(0); i < n; i += BigInt(1)) {
    const raw = await client.readContract({
      address: coreAddress,
      abi: playscriptCoreReadAbi,
      functionName: "getScript",
      args: [i],
    });
    const script = normalizeScript(raw);
    if (!script) continue;
    if (getAddress(script.owner).toLowerCase() !== ownerLc) continue;
    out.push({ scriptId: i, script });
  }

  return out.reverse();
}

/** Global receipt lookup (not owner-bound). Newest script wins if duplicates exist. */
export async function findScriptByReceipt(
  coreAddress: `0x${string}`,
  receipt: `0x${string}`,
): Promise<{ scriptId: bigint; script: OnChainScriptRow } | null> {
  const client = createSomniaPublicClient();
  const receiptLc = receipt.toLowerCase();

  const next = await client.readContract({
    address: coreAddress,
    abi: playscriptCoreReadAbi,
    functionName: "nextScriptId",
  });
  const n = BigInt(next);

  for (let i = n - BigInt(1); i >= BigInt(0); i -= BigInt(1)) {
    const raw = await client.readContract({
      address: coreAddress,
      abi: playscriptCoreReadAbi,
      functionName: "getScript",
      args: [i],
    });
    const script = normalizeScript(raw);
    if (!script) continue;
    if (script.choicesReceipt.toLowerCase() !== receiptLc) continue;
    return { scriptId: i, script };
  }

  return null;
}
