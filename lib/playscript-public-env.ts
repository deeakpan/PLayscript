import { getAddress, isAddress } from "viem";

export type PlayscriptEnvStatus =
  | { ok: true; playToken: `0x${string}`; playscriptCore: `0x${string}` }
  | { ok: false; reason: string };

function parseAddr(name: string, raw: string | undefined): `0x${string}` | null {
  const v = raw?.trim().replace(/^["']|["']$/g, "") ?? "";
  if (!v) return null;
  if (!isAddress(v)) return null;
  return getAddress(v) as `0x${string}`;
}

/** Reads `NEXT_PUBLIC_PLAY_TOKEN_ADDRESS` + `NEXT_PUBLIC_PLAYSCRIPT_CORE_ADDRESS`. */
export function getPlayscriptClientEnv(): PlayscriptEnvStatus {
  const playToken = parseAddr(
    "NEXT_PUBLIC_PLAY_TOKEN_ADDRESS",
    process.env.NEXT_PUBLIC_PLAY_TOKEN_ADDRESS,
  );
  const playscriptCore = parseAddr(
    "NEXT_PUBLIC_PLAYSCRIPT_CORE_ADDRESS",
    process.env.NEXT_PUBLIC_PLAYSCRIPT_CORE_ADDRESS,
  );
  if (!playToken && !playscriptCore) {
    return {
      ok: false,
      reason: "Set NEXT_PUBLIC_PLAY_TOKEN_ADDRESS and NEXT_PUBLIC_PLAYSCRIPT_CORE_ADDRESS.",
    };
  }
  if (!playToken) return { ok: false, reason: "Set NEXT_PUBLIC_PLAY_TOKEN_ADDRESS." };
  if (!playscriptCore) return { ok: false, reason: "Set NEXT_PUBLIC_PLAYSCRIPT_CORE_ADDRESS." };
  return { ok: true, playToken, playscriptCore };
}

export function playscriptContractsConfigured(): boolean {
  return getPlayscriptClientEnv().ok;
}
