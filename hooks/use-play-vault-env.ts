import { useMemo } from "react";

import { getPlayscriptV2VaultEnv, type PlayscriptV2VaultEnvStatus } from "@/lib/playscript-public-env";

/** Client-safe read of `NEXT_PUBLIC_PLAYSCRIPT_V2_VAULT_ADDRESS`. */
export function usePlayVaultEnv(): PlayscriptV2VaultEnvStatus {
  return useMemo(() => getPlayscriptV2VaultEnv(), []);
}
