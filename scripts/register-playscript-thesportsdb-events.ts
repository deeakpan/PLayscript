// @ts-nocheck — Hardhat-viem on `hre`; root tsconfig excludes scripts.
import hre from "hardhat";

import { parseEnvAddress } from "./lib/parse-env-address";

/** Mirrors `UPCOMING_LEAGUES` in `lib/fixtures-shared.ts` — PlayscriptCore.Sport enum order. */
const LEAGUE_ID_TO_SPORT_ENUM: Record<string, number> = {
  "4480": 0,
  "4328": 0,
  "4330": 0,
  "4335": 0,
  "4396": 0,
  "4387": 1,
  "4391": 2,
  "4424": 3,
};

function sportEnumFromLeagueId(leagueId: string): number {
  const id = leagueId.trim();
  if (LEAGUE_ID_TO_SPORT_ENUM[id] !== undefined) return LEAGUE_ID_TO_SPORT_ENUM[id]!;
  return 0;
}

/**
 * Registers PlayscriptCore matches from real TheSportsDB events (kickoff from API).
 * Settlement opens **3 hours after kickoff** (`finalizeDelaySec = 10_800`).
 *
 * Default pair (same as site routes `fixtures/2371637?league=4387` & `fixtures/2279694?league=4335`):
 *   - 2371637 — NBA (league 4387)
 *   - 2279694 — La Liga (league 4335)
 *
 * Override events (comma-separated `eventId:leagueId` — league id maps sport, see `LEAGUE_ID_TO_SPORT_ENUM`):
 *   `PLAYSCRIPT_REGISTER_PAIRS=2274928:4396,2452576:4480`
 *
 * On-chain JSON URL: `lookupevent.php?id=<eventId>` — selectors use `events[0].…`.
 *
 * `.env`: `PLAYSCRIPT_CORE_ADDRESS`, `PRIVATE_KEY` (core owner).
 * Optional: `PLAYSCRIPT_THESPORTSDB_KEY` (default `3`, path segment before `/lookupevent.php`).
 */
const THESPORTSDB_KEY = (process.env.PLAYSCRIPT_THESPORTSDB_KEY ?? "3").trim() || "3";
const FINALIZE_DELAY_SEC = 10_800; // 3 hours after kickoff

type ApiEvent = {
  idEvent?: string;
  idLeague?: string | null;
  dateEvent?: string | null;
  strTime?: string | null;
  strTimestamp?: string | null;
  strHomeTeam?: string | null;
  strAwayTeam?: string | null;
  strLeague?: string | null;
};

const DEFAULT_EVENTS: readonly { eventId: string; leagueHint: string }[] = [
  { eventId: "2371637", leagueHint: "4387" },
  { eventId: "2279694", leagueHint: "4335" },
];

function getEventsToRegister(): { eventId: string; leagueHint: string }[] {
  const raw = process.env.PLAYSCRIPT_REGISTER_PAIRS?.trim();
  if (!raw) return [...DEFAULT_EVENTS];
  const out: { eventId: string; leagueHint: string }[] = [];
  for (const part of raw.split(",")) {
    const s = part.trim();
    if (!s) continue;
    const bits = s.split(":").map((x) => x.trim());
    if (bits.length !== 2 || !bits[0] || !bits[1]) {
      throw new Error(
        `PLAYSCRIPT_REGISTER_PAIRS bad segment "${part}" — use eventId:leagueId (e.g. 2274928:4396).`,
      );
    }
    out.push({ eventId: bits[0]!, leagueHint: bits[1]! });
  }
  if (out.length === 0) throw new Error("PLAYSCRIPT_REGISTER_PAIRS produced no events.");
  return out;
}

function kickoffUtcIso(ev: ApiEvent): string {
  const ts = ev.strTimestamp?.trim();
  if (ts && /^\d{4}-\d{2}-\d{2}/.test(ts)) {
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(ts)) {
      const d = new Date(ts.replace(" ", "T"));
      return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    }
    const normalized = ts.includes("T") ? ts.replace(" ", "T") : ts.replace(" ", "T");
    const base = normalized.slice(0, 19);
    return `${base}Z`;
  }
  const d = ev.dateEvent?.trim();
  const t = (ev.strTime ?? "12:00:00").trim();
  if (d) return `${d}T${t}Z`;
  return new Date().toISOString();
}

async function lookupEvent(eventId: string): Promise<ApiEvent> {
  const base = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_KEY}`;
  const url = `${base}/lookupevent.php?id=${encodeURIComponent(eventId)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`TheSportsDB HTTP ${res.status} for ${url}`);
  const json = (await res.json()) as { events?: ApiEvent[] | null };
  const ev = json.events?.[0];
  const got = ev?.idEvent?.trim();
  if (!ev || got !== eventId) {
    throw new Error(
      `lookupevent returned no row or wrong idEvent (want ${eventId}, got ${got ?? "—"}).`,
    );
  }
  return ev;
}

async function main() {
  const coreAddr = parseEnvAddress("PLAYSCRIPT_CORE_ADDRESS");
  const wallets = await hre.viem.getWalletClients();
  if (wallets.length === 0) throw new Error("No wallet (set PRIVATE_KEY).");
  const wallet = wallets[0]!;

  const publicClient = await hre.viem.getPublicClient();
  const head = await publicClient.getBlock({ blockTag: "latest" });
  const chainNow = Number(head.timestamp);

  const core = await hre.viem.getContractAt("PlayscriptCore", coreAddr, {
    client: { wallet },
  });

  const owner = await core.read.owner();
  if (owner.toLowerCase() !== wallet.account.address.toLowerCase()) {
    throw new Error(`PRIVATE_KEY must be core owner (owner=${owner}).`);
  }

  const baseJsonUrl = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_KEY}/lookupevent.php`;
  const onChainUrl = (id: string) => `${baseJsonUrl}?id=${encodeURIComponent(id)}`;

  const events = getEventsToRegister();

  console.log("TheSportsDB key:", THESPORTSDB_KEY);
  console.log("finalizeDelaySec:", FINALIZE_DELAY_SEC, "(3h after kickoff)");
  console.log("events:", events.map((e) => `${e.eventId}:${e.leagueHint}`).join(", "), "\n");

  for (const { eventId, leagueHint } of events) {
    const ev = await lookupEvent(eventId);
    const iso = kickoffUtcIso(ev);
    const kickoff = BigInt(Math.floor(new Date(iso).getTime() / 1000));
    if (kickoff <= BigInt(chainNow)) {
      throw new Error(
        `Event ${eventId} kickoff is in the past (kickoff unix ${kickoff}, chain now ${chainNow}). ` +
          `Pick a future fixture or wait for API data to update.`,
      );
    }

    const leagueId = (ev.idLeague ?? leagueHint)?.trim() ?? leagueHint;
    const sport = sportEnumFromLeagueId(leagueId);

    const url = onChainUrl(eventId);
    const selHomeScore = "events[0].intHomeScore";
    const selAwayScore = "events[0].intAwayScore";
    const selStatus = "events[0].strStatus";
    const selHomeTeam = "events[0].strHomeTeam";
    const selAwayTeam = "events[0].strAwayTeam";

    const home = (ev.strHomeTeam ?? "?").trim();
    const away = (ev.strAwayTeam ?? "?").trim();
    const finalizeAfter = kickoff + BigInt(FINALIZE_DELAY_SEC);

    console.log(`— Event ${eventId} (${leagueHint})`);
    console.log("  ", home, "vs", away, "| league", leagueId, "| sport enum", sport);
    console.log("  kickoff UTC:", iso, "→ unix", kickoff.toString());
    console.log("  settle after unix:", finalizeAfter.toString());
    console.log("  on-chain URL:", url);

    const before = await core.read.nextMatchId();
    const hash = await core.write.registerMatch([
      sport,
      kickoff,
      FINALIZE_DELAY_SEC,
      url,
      selHomeScore,
      selAwayScore,
      selStatus,
      selHomeTeam,
      selAwayTeam,
    ]);
    await publicClient.waitForTransactionReceipt({ hash });
    const after = await core.read.nextMatchId();
    if (after !== before + 1n) throw new Error("Unexpected nextMatchId");
    const matchId = before;
    console.log("  registered matchId:", matchId.toString(), "tx:", hash, "\n");
  }

  console.log("Set PLAYSCRIPT_MATCH_ID to the id you want to lock/settle.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
