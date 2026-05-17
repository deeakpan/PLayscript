import { getAddress, isAddress } from "viem";

import {
  getV2DeploymentContract,
  getV2DeploymentPlayToken,
} from "@/lib/playscript-v2-deployment-file";

export type PlayscriptEnvStatus =
  | { ok: true; playToken: `0x${string}`; playscriptCore: `0x${string}` }
  | { ok: false; reason: string };

function parseAddr(name: string, raw: string | undefined): `0x${string}` | null {
  const v = raw?.trim().replace(/^["']|["']$/g, "") ?? "";
  if (!v) return null;
  if (!isAddress(v)) return null;
  return getAddress(v) as `0x${string}`;
}

export type PlayTokenEnvStatus =
  | { ok: true; playToken: `0x${string}` }
  | { ok: false; reason: string };

/**
 * PLAY token for header balance and vault UI (wagmi `balanceOf` via `getPlayTokenEnv`).
 * Order: `deployments/playscript-v2-somnia.json` (`playToken` → `contracts.PlayToken`), then env.
 */
export function getPlayTokenEnv(): PlayTokenEnvStatus {
  const playToken =
    getV2DeploymentPlayToken() ??
    getV2DeploymentContract("PlayToken") ??
    parseAddr("NEXT_PUBLIC_PLAY_TOKEN_ADDRESS", process.env.NEXT_PUBLIC_PLAY_TOKEN_ADDRESS) ??
    parseAddr("PLAY_TOKEN_ADDRESS", process.env.PLAY_TOKEN_ADDRESS);
  if (!playToken) {
    return {
      ok: false,
      reason:
        "No PLAY token: add `playToken` to deployments/playscript-v2-somnia.json or set NEXT_PUBLIC_PLAY_TOKEN_ADDRESS.",
    };
  }
  return { ok: true, playToken };
}

/** Reads `NEXT_PUBLIC_PLAYSCRIPT_CORE_ADDRESS` + PLAY token (`getPlayTokenEnv`). */
export function getPlayscriptClientEnv(): PlayscriptEnvStatus {
  const playEnv = getPlayTokenEnv();
  const playscriptCore = parseAddr(
    "NEXT_PUBLIC_PLAYSCRIPT_CORE_ADDRESS",
    process.env.NEXT_PUBLIC_PLAYSCRIPT_CORE_ADDRESS,
  );
  if (!playEnv.ok && !playscriptCore) {
    return {
      ok: false,
      reason:
        "Set NEXT_PUBLIC_PLAYSCRIPT_CORE_ADDRESS and configure PLAY (deployments/playscript-v2-somnia.json playToken or NEXT_PUBLIC_PLAY_TOKEN_ADDRESS).",
    };
  }
  if (!playEnv.ok) {
    return { ok: false, reason: playEnv.reason };
  }
  if (!playscriptCore) return { ok: false, reason: "Set NEXT_PUBLIC_PLAYSCRIPT_CORE_ADDRESS." };
  return { ok: true, playToken: playEnv.playToken, playscriptCore };
}

export function playscriptContractsConfigured(): boolean {
  return getPlayscriptClientEnv().ok;
}

export type PlayscriptV2KernelEnvStatus =
  | { ok: true; kernel: `0x${string}` }
  | { ok: false; reason: string };

/** Optional v2 kernel for permissionless `registerMatch` from the fixture UI (falls back to `deployments/playscript-v2-somnia.json`). */
export function getPlayscriptV2KernelEnv(): PlayscriptV2KernelEnvStatus {
  const kernel =
    parseAddr(
      "NEXT_PUBLIC_PLAYSCRIPT_V2_KERNEL_ADDRESS",
      process.env.NEXT_PUBLIC_PLAYSCRIPT_V2_KERNEL_ADDRESS,
    ) ?? getV2DeploymentContract("PlayscriptKernel");
  if (!kernel) {
    return {
      ok: false,
      reason:
        "No v2 kernel: set NEXT_PUBLIC_PLAYSCRIPT_V2_KERNEL_ADDRESS or run npm run deploy:playscript-v2:somnia and commit deployments/playscript-v2-somnia.json.",
    };
  }
  return { ok: true, kernel };
}

export type PlayscriptV2PositionsEnvStatus =
  | { ok: true; positions: `0x${string}`; playToken: `0x${string}` }
  | { ok: false; reason: string };

export type PlayscriptV2VaultEnvStatus =
  | { ok: true; vault: `0x${string}` }
  | { ok: false; reason: string };

/** Optional `PlayVault` for LP UI / reads (falls back to `deployments/playscript-v2-somnia.json`). */
export function getPlayscriptV2VaultEnv(): PlayscriptV2VaultEnvStatus {
  const vault =
    parseAddr(
      "NEXT_PUBLIC_PLAYSCRIPT_V2_VAULT_ADDRESS",
      process.env.NEXT_PUBLIC_PLAYSCRIPT_V2_VAULT_ADDRESS,
    ) ?? getV2DeploymentContract("PlayVault");
  if (!vault) {
    return {
      ok: false,
      reason:
        "No v2 vault: set NEXT_PUBLIC_PLAYSCRIPT_V2_VAULT_ADDRESS or run npm run deploy:playscript-v2:somnia and commit deployments/playscript-v2-somnia.json.",
    };
  }
  return { ok: true, vault };
}

/** ERC-1155 v2 positions: needs same PLAY token users approve for `lockScript` (addresses fall back to `deployments/playscript-v2-somnia.json`). */
export type PlayscriptV2LockRegistryEnvStatus =
  | { ok: true; lockRegistry: `0x${string}` }
  | { ok: false; reason: string };

/** On-chain lock index for My Scripts (`PlayscriptV2LockRegistry`). */
export function getPlayscriptV2LockRegistryEnv(): PlayscriptV2LockRegistryEnvStatus {
  const lockRegistry =
    parseAddr(
      "NEXT_PUBLIC_PLAYSCRIPT_V2_LOCK_REGISTRY_ADDRESS",
      process.env.NEXT_PUBLIC_PLAYSCRIPT_V2_LOCK_REGISTRY_ADDRESS,
    ) ?? getV2DeploymentContract("PlayscriptV2LockRegistry");
  if (!lockRegistry) {
    return {
      ok: false,
      reason:
        "No v2 lock registry: set NEXT_PUBLIC_PLAYSCRIPT_V2_LOCK_REGISTRY_ADDRESS or add PlayscriptV2LockRegistry to deployments/playscript-v2-somnia.json.",
    };
  }
  return { ok: true, lockRegistry };
}

export function playscriptV2LockRegistryConfigured(): boolean {
  return getPlayscriptV2LockRegistryEnv().ok;
}

export function getPlayscriptV2PositionsEnv(): PlayscriptV2PositionsEnvStatus {
  const positions =
    parseAddr(
      "NEXT_PUBLIC_PLAYSCRIPT_V2_POSITIONS_ADDRESS",
      process.env.NEXT_PUBLIC_PLAYSCRIPT_V2_POSITIONS_ADDRESS,
    ) ?? getV2DeploymentContract("PlayscriptV2Positions");
  const playEnv = getPlayTokenEnv();
  if (!positions) {
    return {
      ok: false,
      reason:
        "Set NEXT_PUBLIC_PLAYSCRIPT_V2_POSITIONS_ADDRESS to lock v2 scripts as ERC-1155 tickets from the UI.",
    };
  }
  if (!playEnv.ok) {
    return { ok: false, reason: playEnv.reason };
  }
  return { ok: true, positions, playToken: playEnv.playToken };
}
