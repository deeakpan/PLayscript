import { getAddress, isAddress } from "viem";

/** Reads `0x` + 40 hex from env; trims quotes/whitespace; EIP-55 checksum for viem. */
export function parseEnvAddress(envName: string): `0x${string}` {
  const raw =
    process.env[envName]?.trim().replace(/^["']|["']$/g, "") ?? "";

  if (!raw) {
    throw new Error(`Set ${envName} in .env (deploy output prints the full line).`);
  }

  const hexBody = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (!/^([0-9a-fA-F]{40})$/.test(hexBody)) {
    if (/^[0-9a-fA-F]{39}$/.test(hexBody)) {
      throw new Error(
        `${envName} is one hex digit short (need 40 after 0x). Often the trailing "0" was dropped — paste the full address from deploy.`,
      );
    }
    throw new Error(
      `${envName} must be 0x followed by exactly 40 hex characters (got ${raw.length} chars).`,
    );
  }

  const normalized = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!isAddress(normalized)) {
    throw new Error(`${envName} is not a valid EVM address: ${raw}`);
  }

  return getAddress(normalized) as `0x${string}`;
}
