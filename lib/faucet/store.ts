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

const LOCAL_PATH = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "faucet-claims.json");
/** Writable on Vercel / AWS Lambda (project dir under `/var/task` is read-only). */
const SERVERLESS_PATH = "/tmp/playscript-faucet-claims.json";

function isServerlessRuntime(): boolean {
  return (
    process.env.VERCEL === "1" ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.VERCEL_ENV)
  );
}

function defaultStorePath(): string {
  return isServerlessRuntime() ? SERVERLESS_PATH : LOCAL_PATH;
}

declare global {
  // eslint-disable-next-line no-var
  var __playscriptFaucetStore: FaucetStoreFile | undefined;
}

function memoryStore(): FaucetStoreFile {
  if (!globalThis.__playscriptFaucetStore) {
    globalThis.__playscriptFaucetStore = { claims: {} };
  }
  return globalThis.__playscriptFaucetStore;
}

function storePath(): string {
  const custom = process.env.FAUCET_DATA_PATH?.trim();
  return custom || defaultStorePath();
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

async function readFileStore(): Promise<FaucetStoreFile> {
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

/** Merge file + in-process cache (helps warm serverless instances). */
async function readStore(): Promise<FaucetStoreFile> {
  const [file, mem] = await Promise.all([readFileStore(), Promise.resolve(memoryStore())]);
  const claims: Record<string, FaucetClaimRecord> = { ...file.claims };
  for (const [addr, rec] of Object.entries(mem.claims)) {
    const existing = claims[addr];
    if (!existing || rec.updatedAt > existing.updatedAt) {
      claims[addr] = rec;
    }
  }
  return { claims };
}

async function writeStore(store: FaucetStoreFile): Promise<void> {
  memoryStore().claims = { ...store.claims };
  const file = storePath();
  const dir = path.dirname(file);
  if (dir !== "/tmp") {
    await fs.mkdir(dir, { recursive: true });
  }
  const payload = `${JSON.stringify(store, null, 2)}\n`;
  try {
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, payload, "utf8");
    await fs.rename(tmp, file);
  } catch {
    await fs.writeFile(file, payload, "utf8");
  }
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

/** Reserve today's slot before mint; roll back if mint fails. */
export async function runFaucetClaim(
  addressLower: string,
  onMint: () => Promise<{ txHash: string }>,
): Promise<
  | { ok: true; txHash: string; lastClaimDay: string; nextClaimAt: null }
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

    const reservedAt = new Date().toISOString();
    store.claims[addressLower] = {
      lastClaimDay: today,
      updatedAt: reservedAt,
    };
    await writeStore(store);

    try {
      const { txHash } = await onMint();
      store.claims[addressLower] = {
        lastClaimDay: today,
        updatedAt: new Date().toISOString(),
        lastTxHash: txHash,
      };
      await writeStore(store);
      return { ok: true, txHash, lastClaimDay: today, nextClaimAt: null };
    } catch (e) {
      const rollback = await readStore();
      if (rollback.claims[addressLower]?.updatedAt === reservedAt) {
        delete rollback.claims[addressLower];
        await writeStore(rollback);
      }
      throw e;
    }
  });
}
