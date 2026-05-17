import "server-only";

const RETRYABLE = new Set(["EAI_AGAIN", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED"]);

export class EspnFetchUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EspnFetchUnavailableError";
  }
}

export function isEspnNetworkError(err: unknown): boolean {
  if (err instanceof EspnFetchUnavailableError) return true;
  return isRetryableFetchError(err);
}

function isRetryableFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code =
    err.cause instanceof Error && "code" in err.cause
      ? String((err.cause as NodeJS.ErrnoException).code)
      : "code" in err
        ? String((err as NodeJS.ErrnoException).code)
        : "";
  if (code && RETRYABLE.has(code)) return true;
  const msg = err.message.toLowerCase();
  return msg.includes("fetch failed") || msg.includes("getaddrinfo");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** ESPN `fetch` with short retries for flaky DNS (common on Windows dev). */
export async function fetchEspn(url: string, init?: RequestInit): Promise<Response> {
  const attempts = 3;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      last = e;
      if (i < attempts - 1 && isRetryableFetchError(e)) {
        await sleep(400 * (i + 1));
        continue;
      }
      if (isRetryableFetchError(e)) {
        throw new EspnFetchUnavailableError(formatEspnNetworkError(e));
      }
      throw e;
    }
  }
  throw last;
}

export function formatEspnNetworkError(err: unknown): string {
  const base = err instanceof Error ? err.message : String(err);
  const code =
    err instanceof Error &&
    err.cause instanceof Error &&
    "code" in err.cause
      ? String((err.cause as NodeJS.ErrnoException).code)
      : null;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return `Cannot reach ESPN (DNS ${code} for site.api.espn.com). Check internet/DNS or set ESPN_FIXTURES_DEV_MOCK=1 for offline dev fixtures.`;
  }
  return base;
}
