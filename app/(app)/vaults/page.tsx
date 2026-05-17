"use client";

import { VaultDetailView } from "@/components/vaults/vault-detail-view";
import { usePlayVaultEnv } from "@/hooks/use-play-vault-env";

export default function VaultsPage() {
  const env = usePlayVaultEnv();

  if (!env.ok) {
    return (
      <p className="text-sm text-rose-400" role="alert">
        {env.reason}
      </p>
    );
  }

  return <VaultDetailView vaultAddress={env.vault} />;
}
