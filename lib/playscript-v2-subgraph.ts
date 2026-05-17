import { playscriptV2LockRegistryConfigured } from "@/lib/playscript-public-env";

/** Client helpers for the Playscript v2 subgraph (`subgraph/`). */

export type V2SubgraphLockRow = {
  id: string;
  matchId: string;
  legMask12: number;
  netStake: string;
  actualStake: string;
  payoutRate: string;
  blockTimestamp: string;
  transactionHash: string;
  match: {
    url: string;
    settled: boolean;
    sport: number;
    kickoff: string;
  };
};

export type V2SubgraphClaimRow = {
  matchId: string;
  legMask12: number;
  netStakeBurned: string;
  payout: string | null;
  blockTimestamp: string;
};

export type V2SubgraphUserHistory = {
  locks: V2SubgraphLockRow[];
  claims: V2SubgraphClaimRow[];
};

const USER_HISTORY_QUERY = `
  query UserScriptHistory($user: ID!) {
    user(id: $user) {
      locks(orderBy: blockTimestamp, orderDirection: desc, first: 100) {
        id
        matchId
        legMask12
        netStake
        actualStake
        payoutRate
        blockTimestamp
        transactionHash
        match {
          url
          settled
          sport
          kickoff
        }
      }
      claims(orderBy: blockTimestamp, orderDirection: desc, first: 100) {
        matchId
        legMask12
        netStakeBurned
        payout
        blockTimestamp
      }
    }
  }
`;

export function getPlayscriptV2SubgraphUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_PLAYSCRIPT_V2_SUBGRAPH_URL?.trim() ?? "";
  return raw.length > 0 ? raw : null;
}

export function playscriptV2SubgraphConfigured(): boolean {
  return getPlayscriptV2SubgraphUrl() != null;
}

/** My Scripts v2: prefer on-chain lock registry, else subgraph. */
export function playscriptV2HistoryConfigured(): boolean {
  return playscriptV2LockRegistryConfigured() || playscriptV2SubgraphConfigured();
}

/** Ormi/graph-node errors while the deployment is still catching up to chain head. */
export function isPlayscriptV2SubgraphIndexingError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("has not started syncing") ||
    m.includes("not started syncing yet") ||
    m.includes("wait for it to ingest") ||
    m.includes("still syncing") ||
    m.includes("indexing in progress")
  );
}

export const playscriptV2SubgraphIndexingMessage =
  "The Playscript indexer is still syncing on Somnia. Your scripts will appear here once it has ingested a few blocks—usually within a few minutes after deploy.";

/** ESPN event id from v2 `registerMatch` url (summary `?event=` or scoreboard path segment). */
export function parseEspnEventIdFromMatchUrl(url: string): string | null {
  const u = url.trim();
  const q = u.match(/[?&]event=(\d+)/i);
  if (q?.[1]) return q[1];
  const parts = u.split("/").filter((p) => p.length > 0);
  const last = parts[parts.length - 1];
  if (last && /^\d+$/.test(last)) return last;
  return null;
}

export async function fetchV2UserScriptHistory(
  subgraphUrl: string,
  userAddress: string,
): Promise<V2SubgraphUserHistory> {
  const user = userAddress.toLowerCase();
  const r = await fetch(subgraphUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: USER_HISTORY_QUERY,
      variables: { user },
    }),
    cache: "no-store",
  });
  const j = (await r.json()) as {
    data?: { user?: V2SubgraphUserHistory | null };
    errors?: { message: string }[];
  };
  if (!r.ok || j.errors?.length) {
    const msg = j.errors?.map((e) => e.message).join("; ") ?? `HTTP ${r.status}`;
    throw new Error(msg);
  }
  const userNode = j.data?.user;
  return {
    locks: userNode?.locks ?? [],
    claims: userNode?.claims ?? [],
  };
}
