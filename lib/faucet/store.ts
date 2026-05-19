import fs from "node:fs/promises";
import path from "node:path";

import { nextUtcDayStartIso, utcDayKey } from "@/lib/faucet/constants";

export type FaucetClaimRecord = {
  lastClaimDay: string;
  updatedAt: string;
  lastTxHash?: string;
};

export type FaucetStoreFile = {
  claims: Record<string, FaucetClaimRecord>;
};

const DEFAULT_PATH = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "faucet-claims.json");

function storePath(): string {
  const custom = process.env.FAUCET_DATA_PATH?.trim();
  return custom || DEFAULT_PATH;
}

let writeChain: Promise<void> = Promise.resolve();

function withStoreLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readStore(): Promise<FaucetStoreFile> {
  try {
    const raw = await fs.readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as FaucetStoreFile;
    if (!parsed || typeof parsed !== "object" || !parsed.claims) {
      return { claims: {} };
    }
    return parsed;
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return { claims: {} };
    throw e;
  }
}

async function writeStore(store: FaucetStoreFile): Promise<void> {
  const file = storePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export type FaucetEligibility = {
  canClaim: boolean;
  lastClaimDay: string | null;
  nextClaimAt: string | null;
};

export function getFaucetEligibility(
  store: FaucetStoreFile,
  addressLower: string,
  today = utcDayKey(),
): FaucetEligibility {
  const rec = store.claims[addressLower];
  const lastClaimDay = rec?.lastClaimDay ?? null;
  if (lastClaimDay === today) {
    return {
      canClaim: false,
      lastClaimDay,
      nextClaimAt: nextUtcDayStartIso(today),
    };
  }
  return { canClaim: true, lastClaimDay, nextClaimAt: null };
}

export async function readFaucetEligibility(addressLower: string): Promise<FaucetEligibility> {
  const store = await readStore();
  return getFaucetEligibility(store, addressLower);
}

/** Reserve today's claim slot, then caller mints; rolls back if `onMint` throws. */
export async function runFaucetClaim(
  addressLower: string,
  onMint: () => Promise<{ txHash: string }>,
): Promise<
  | { ok: true; txHash: string; lastClaimDay: string }
  | { ok: false; code: "already_claimed"; nextClaimAt: string }
> {
  return withStoreLock(async () => {
    const today = utcDayKey();
    const store = await readStore();
    const elig = getFaucetEligibility(store, addressLower, today);
    if (!elig.canClaim) {
      return {
        ok: false,
        code: "already_claimed",
        nextClaimAt: elig.nextClaimAt ?? nextUtcDayStartIso(today),
      };
    }

    const { txHash } = await onMint();

    store.claims[addressLower] = {
      lastClaimDay: today,
      updatedAt: new Date().toISOString(),
      lastTxHash: txHash,
    };
    await writeStore(store);

    return { ok: true, txHash, lastClaimDay: today };
  });
}
