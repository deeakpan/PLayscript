import { createPublicClient, http } from "viem";

import { somniaTestnet } from "@/lib/chains/somnia";
import { extractMatchUrlFromRead, normalizeMatchUrl } from "@/lib/playscript-match-url";
import { playTokenReadAbi, playscriptCoreReadAbi } from "@/lib/playscript-onchain-abi";
import { getServerSomniaRpcUrl } from "@/lib/somnia-server-rpc";

export function createSomniaPublicClient() {
  const url = getServerSomniaRpcUrl();
  return createPublicClient({
    chain: somniaTestnet,
    transport: http(url, { timeout: 25_000 }),
  });
}

export async function resolvePlayscriptMatchIdByUrl(
  coreAddress: `0x${string}`,
  candidateUrl: string,
): Promise<bigint | null> {
  const client = createSomniaPublicClient();
  const target = normalizeMatchUrl(candidateUrl);
  const next = await client.readContract({
    address: coreAddress,
    abi: playscriptCoreReadAbi,
    functionName: "nextMatchId",
  });
  const n = BigInt(next);
  for (let i = BigInt(0); i < n; i += BigInt(1)) {
    const row = await client.readContract({
      address: coreAddress,
      abi: playscriptCoreReadAbi,
      functionName: "matches_",
      args: [i],
    });
    const url = extractMatchUrlFromRead(row);
    if (url && normalizeMatchUrl(url) === target) return i;
  }
  return null;
}

export async function readPlayBalance(
  tokenAddress: `0x${string}`,
  owner: `0x${string}`,
): Promise<{ raw: bigint; decimals: number }> {
  const client = createSomniaPublicClient();
  const [raw, dec] = await Promise.all([
    client.readContract({
      address: tokenAddress,
      abi: playTokenReadAbi,
      functionName: "balanceOf",
      args: [owner],
    }),
    client.readContract({
      address: tokenAddress,
      abi: playTokenReadAbi,
      functionName: "decimals",
    }),
  ]);
  const decimals = Number(dec);
  return {
    raw,
    decimals: Number.isFinite(decimals) && decimals >= 0 && decimals <= 36 ? decimals : 18,
  };
}
