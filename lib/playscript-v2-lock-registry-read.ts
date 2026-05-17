import { getAddress, type Address } from "viem";

import { createSomniaPublicClient } from "@/lib/playscript-read-onchain";
import { playscriptV2LockRegistryReadAbi } from "@/lib/playscript-v2-lock-registry-abi";

export type V2RegistryLockRow = {
  lockId: bigint;
  matchId: bigint;
  legMask12: number;
  actualStake: bigint;
  netStake: bigint;
  payoutRate: bigint;
  blockNumber: bigint;
  claimed: boolean;
};

const DEFAULT_PAGE = BigInt(50);

export async function fetchV2UserLocksFromRegistry(
  registryAddress: Address,
  userAddress: Address,
  limit = DEFAULT_PAGE,
): Promise<V2RegistryLockRow[]> {
  const client = createSomniaPublicClient();
  const user = getAddress(userAddress);
  const total = await client.readContract({
    address: registryAddress,
    abi: playscriptV2LockRegistryReadAbi,
    functionName: "userLockCount",
    args: [user],
  });
  if (total === BigInt(0)) return [];

  const rows: V2RegistryLockRow[] = [];
  let offset = BigInt(0);
  while (offset < total) {
    const take = total - offset > limit ? limit : total - offset;
    const page = await client.readContract({
      address: registryAddress,
      abi: playscriptV2LockRegistryReadAbi,
      functionName: "getUserLocks",
      args: [user, offset, take],
    });
    const [
      lockIds,
      matchIds,
      legMask12s,
      actualStakes,
      netStakes,
      payoutRates,
      blockNumbers,
      claimedFlags,
    ] = page;
    for (let i = 0; i < lockIds.length; i++) {
      rows.push({
        lockId: lockIds[i]!,
        matchId: matchIds[i]!,
        legMask12: Number(legMask12s[i]!),
        actualStake: actualStakes[i]!,
        netStake: netStakes[i]!,
        payoutRate: payoutRates[i]!,
        blockNumber: blockNumbers[i]!,
        claimed: claimedFlags[i]!,
      });
    }
    offset += take;
  }
  return rows;
}
