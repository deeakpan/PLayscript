import { notFound } from "next/navigation";
import { getAddress, isAddress } from "viem";

import { VaultDetailView } from "@/components/vaults/vault-detail-view";

export default async function VaultByAddressPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: raw } = await params;
  const decoded = decodeURIComponent(raw).trim();
  if (!isAddress(decoded)) notFound();
  const vaultAddress = getAddress(decoded) as `0x${string}`;

  return <VaultDetailView vaultAddress={vaultAddress} />;
}
