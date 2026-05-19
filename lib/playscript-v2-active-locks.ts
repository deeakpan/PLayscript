import type { Address, PublicClient } from "viem";

import type { V2RegistryLockRow } from "@/lib/playscript-v2-lock-registry-read";
import { playscriptV2PositionsReadAbi } from "@/lib/playscript-v2-positions-abi";
import { v2ScriptTokenId } from "@/lib/playscript-v2-script-token-id";

export type V2LockWithBalance = V2RegistryLockRow & { balance: bigint };

/** Locks the user still holds (ERC-1155) or already claimed — excludes unwind (balance 0, not claimed). */
export async function readV2LocksWithBalances(
  client: PublicClient,
  positions: Address,
  owner: Address,
  locks: V2RegistryLockRow[],
): Promise<V2LockWithBalance[]> {
  if (locks.length === 0) return [];

  const withBalance = await Promise.all(
    locks.map(async (lock) => {
      const tokenId = v2ScriptTokenId(lock.matchId, lock.legMask12);
      const balance = await client.readContract({
        address: positions,
        abi: playscriptV2PositionsReadAbi,
        functionName: "balanceOf",
        args: [owner, tokenId],
      });
      return { ...lock, balance };
    }),
  );

  return withBalance.filter((row) => row.balance > BigInt(0) || row.claimed);
}
