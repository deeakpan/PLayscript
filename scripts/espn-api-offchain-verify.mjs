/**
 * Offchain smoke test for `espn-api-docs.md` —
 * fetches live ESPN JSON and asserts documented paths exist for Playscript-supported sports.
 *
 * Run: node scripts/espn-api-offchain-verify.mjs
 * Env: ESPN_VERIFY_STRICT=1 to fail on NBA/NFL/MLB if sample events 404.
 *
 * Soccer: primary deep probe is still EPL (`eng.1`); additionally samples **esp.1, ita.1, ger.1,
 * uefa.champions** for the same header-vs-boxscore half diagnostic (`soccer_cross_league_half_probe`
 * in emitted JSON). Edit `SAMPLES.soccer_cross_league_half_probe` to add league slugs/dates.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_JSON = join(ROOT, "lib", "espn-mock-hardcoded.generated.json");

const BASE = "https://site.api.espn.com/apis/site/v2/sports";

/** Default sample events (refresh via scoreboard probes where noted). */
const SAMPLES = {
  soccer_eng1: { league: "soccer/eng.1", eventId: "740902" },
  /** Used to pick another EPL fixture (first completed game on calendar day, skips primary id). */
  soccer_eng1_alt_dates: ["20251108", "20251025", "20250118"],
  /** Extra EPL games for header vs boxscore half diagnostics (beyond primary + alt). */
  soccer_half_source_scan_dates: ["20251108", "20251025", "20250118"],
  /**
   * One sample match per non-EPL soccer league — header vs boxscore half diagnostic.
   * Dates are ESPN `scoreboard?dates=` YYYYMMDD; first date with ≥1 event wins.
   */
  soccer_cross_league_half_probe: [
    { key: "esp.1", league: "soccer/esp.1", dates: ["20251026", "20251025", "20250928"] },
    { key: "ita.1", league: "soccer/ita.1", dates: ["20251026", "20251025"] },
    { key: "ger.1", league: "soccer/ger.1", dates: ["20251026", "20251025"] },
    {
      key: "uefa.champions",
      league: "soccer/uefa.champions",
      dates: ["20251105", "20251104", "20251022", "20251021"],
    },
  ],
  /** Docs example — may 404 someday */
  soccer_docs: { league: "soccer/uefa.champions", eventId: "401862582" },
  nba: { league: "basketball/nba", eventId: "400878160" },
  nfl: { league: "football/nfl", eventId: "401671764" },
  /** Filled from MLB scoreboard if missing */
  mlb: { league: "baseball/mlb", eventId: null, dateFallback: "20250515" },
};

function pick(obj, pathStr) {
  const parts = pathStr.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function fetchJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON from ${url} HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return { ok: res.ok, status: res.status, data };
}

/** Count soccer yellow cards from scoreboard competitions[0].details */
function countYellowInDetails(details) {
  if (!Array.isArray(details)) return 0;
  return details.filter((d) => d && d.yellowCard === true).length;
}

/** Count soccer red cards from scoreboard competitions[0].details */
function countRedInDetails(details) {
  if (!Array.isArray(details)) return 0;
  return details.filter((d) => d && d.redCard === true).length;
}

/** Team-level yellow/red from summary `boxscore.teams[].statistics` (paths vary by ESPN shape). */
function extractTeamDisciplineFromSummaryTeams(sumData) {
  const teams = sumData?.boxscore?.teams ?? [];
  const out = [];
  for (let i = 0; i < teams.length; i++) {
    const stats = teams[i]?.statistics;
    if (!Array.isArray(stats)) {
      out.push({
        bucketIndex: i,
        homeAway: teams[i]?.homeAway ?? null,
        displayName: teams[i]?.team?.displayName ?? null,
        yellowCards_display: null,
        redCards_display: null,
      });
      continue;
    }
    const yi = stats.findIndex((s) => s?.name === "yellowCards");
    const ri = stats.findIndex((s) => s?.name === "redCards");
    const yc = yi >= 0 ? stats[yi] : null;
    const rc = ri >= 0 ? stats[ri] : null;
    out.push({
      bucketIndex: i,
      homeAway: teams[i]?.homeAway ?? null,
      displayName: teams[i]?.team?.displayName ?? null,
      yellowCards_display: yc?.displayValue ?? null,
      redCards_display: rc?.displayValue ?? null,
      yellowCardsPath: yc ? `boxscore.teams[${i}].statistics[${yi}].displayValue` : null,
      redCardsPath: rc ? `boxscore.teams[${i}].statistics[${ri}].displayValue` : null,
    });
  }
  return out;
}

/** ESPN linescore entry → plain number/display for logging + JSON */
function tidyLinescoreSlice(ls) {
  if (!Array.isArray(ls)) return [];
  return ls.map((x, idx) => ({
    idx,
    period: x?.period ?? x?.ordinal ?? idx + 1,
    value: x?.value ?? null,
    displayValue: x?.displayValue ?? null,
    shortName: x?.shortDisplayName ?? x?.abbreviation ?? null,
  }));
}

/** Sum numeric `displayValue` or `value` for index range [start, end) */
function sliceSum(rows, start, end) {
  let s = 0;
  for (let i = start; i < end && i < rows.length; i++) {
    const r = rows[i];
    const n = Number(r?.displayValue ?? r?.value);
    if (!Number.isFinite(n)) return null;
    s += n;
  }
  return s;
}

function logSoccerDisciplineBlock(d) {
  const det = d.discipline_scoreboard_details;
  const teams = d.discipline_summary_team_statistics;
  if (det) {
    console.log(
      "  discipline scoreboard `details` flags: yellow=",
      det.yellowCard_true_count,
      "red=",
      det.redCard_true_count,
      "entries=",
      det.detail_entry_count,
      "HTTP",
      det.scoreboard_http_ok,
    );
  }
  if (Array.isArray(teams) && teams.length) {
    console.log(
      "  discipline summary statistics (per team):",
      teams.map((t) => `${t.displayName ?? "?"}: Y=${t.yellowCards_display ?? "?"} R=${t.redCards_display ?? "?"}`),
    );
  }
}

/**
 * Soccer half-time: often on summary `header.competitions[0].competitors[].linescores`,
 * NOT on `boxscore.teams[].linescores`.
 */
function extractSoccerHalvesFromSummary(sumData) {
  const comps = sumData?.header?.competitions?.[0]?.competitors;
  if (!Array.isArray(comps)) return null;
  const home = comps.find((c) => c?.homeAway === "home");
  const away = comps.find((c) => c?.homeAway === "away");
  if (!home || !away) return null;
  const hl = tidyLinescoreSlice(home.linescores).map(({ displayValue }) => displayValue ?? null);
  const al = tidyLinescoreSlice(away.linescores).map(({ displayValue }) => displayValue ?? null);
  return {
    headerHomeTeam: home.team?.displayName,
    headerAwayTeam: away.team?.displayName,
    half1Home_display: hl[0] ?? null,
    half1Away_display: al[0] ?? null,
    half2Home_display: hl[1] ?? null,
    half2Away_display: al[1] ?? null,
    rawHalfArrays: { home: hl, away: al },
  };
}

function verdictHeaderVsBoxscore(headerHalves, boxByHA) {
  const hh = headerHalves?.rawHalfArrays?.home;
  const headerOk = Array.isArray(hh) && hh.some((x) => x != null && x !== "");
  const boxOk = !!(boxByHA && Object.keys(boxByHA).length &&
    Object.values(boxByHA).some((row) => row.len > 0 && row.firstTwo.some((x) => x != null && x !== "")));
  if (headerOk && boxOk) return "BOTH";
  if (headerOk) return "HEADER_ONLY";
  if (boxOk) return "BOXSCORE_ONLY";
  return "NEITHER";
}

async function diagnoseSoccerHalfSources(league, eventId) {
  const summaryUrl = `${BASE}/${league}/summary?event=${eventId}`;
  const sum = await fetchJson(summaryUrl);
  if (!sum.ok)
    return { ok: false, eventId, summaryUrl, summaryHttpStatus: sum.status };

  const comps = sum.data?.header?.competitions?.[0]?.competitors ?? [];
  const homeHc = comps.find((c) => c?.homeAway === "home");
  const awayHc = comps.find((c) => c?.homeAway === "away");
  /** @type {Record<string, { bucketIndex: number, len: number, firstTwo: (string|null)[]}>} */
  const boxByHA = {};
  const teams = sum.data?.boxscore?.teams ?? [];
  teams.forEach((t, idx) => {
    const ls = tidyLinescoreSlice(t?.linescores);
    const displays = ls.map(({ displayValue, value }) => displayValue ?? (value != null ? String(value) : null));
    const ha = t?.homeAway ?? `unknown_${idx}`;
    boxByHA[ha] = {
      bucketIndex: idx,
      len: ls.length,
      firstTwo: displays.slice(0, 2),
    };
  });

  const headerHalves = extractSoccerHalvesFromSummary(sum.data);
  const verdict = verdictHeaderVsBoxscore(headerHalves, boxByHA);

  const scoreboardUrl = `${BASE}/${league}/scoreboard/${eventId}`;
  const sb = await fetchJson(scoreboardUrl);
  const comp0 = sb.data?.competitions?.[0];
  const details = comp0?.details;
  const disciplineFromDetails = {
    scoreboard_http_ok: sb.ok,
    yellowCard_true_count: countYellowInDetails(details),
    redCard_true_count: countRedInDetails(details),
    detail_entry_count: Array.isArray(details) ? details.length : 0,
  };

  const disciplineFromSummaryStats = extractTeamDisciplineFromSummaryTeams(sum.data);

  return {
    ok: true,
    eventId,
    summaryUrl,
    scoreboardUrl,
    /** Empty `boxscore.teams[].linescores` for half splits is **not EPL-only** in our samples — same across eng/esp/ita/ger/ucl. Use `header` competitor `linescores` for halves. */
    half_split_note:
      "Prefer header.competitions[0].competitors[home|away].linescores for half-by-half goals; boxscore.teams[].linescores often len 0 (verified multiple leagues).",
    verdict,
    headerHalves,
    headerFinalScores: {
      home: homeHc?.score ?? null,
      away: awayHc?.score ?? null,
    },
    boxscoreTeamsLinescoresByHomeAway: boxByHA,
    boxscoreTeamsOrder: teams.map((t, i) => ({
      i,
      homeAway: t?.homeAway,
      team: t?.team?.displayName,
      linescoreLen: t?.linescores?.length ?? 0,
    })),
    discipline_scoreboard_details: disciplineFromDetails,
    discipline_summary_team_statistics: disciplineFromSummaryStats,
  };
}

/** Collect event ids from `scoreboard?dates=` for any `soccer/{league}` path. */
async function resolveSoccerLeagueEventIdsExcluding(league, dateStrList, excludeIds, limit) {
  const seen = new Set([...excludeIds].map(String));
  const out = [];
  for (const dateStr of dateStrList) {
    const url = `${BASE}/${league}/scoreboard?dates=${dateStr}`;
    const r = await fetchJson(url);
    if (!r.ok || !Array.isArray(r.data?.events)) continue;
    for (const ev of r.data.events) {
      const id = ev?.id != null ? String(ev.id) : null;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const comp = ev.competitions?.[0];
      out.push({
        eventId: id,
        dateStr,
        label: comp?.shortName ?? ev.shortName ?? ev.name,
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** First event id resolved from dated scoreboards for a league (any single matchday). */
async function resolveFirstSoccerEventMeta(league, dateStrList) {
  const list = await resolveSoccerLeagueEventIdsExcluding(league, dateStrList, [], 1);
  return list[0] ?? null;
}

async function resolveSoccerEng1AltExclude(primaryId, dateStrList) {
  const skip = new Set([String(primaryId)]);
  for (const dateStr of dateStrList) {
    const url = `${BASE}/soccer/eng.1/scoreboard?dates=${dateStr}`;
    const r = await fetchJson(url);
    if (!r.ok || !Array.isArray(r.data?.events)) continue;
    for (const ev of r.data.events) {
      const id = ev?.id != null ? String(ev.id) : null;
      if (!id || skip.has(id)) continue;
      const comp = ev.competitions?.[0];
      const st = comp?.status?.type?.name ?? "";
      if (st.includes("FULL") || st === "STATUS_FINAL" || /final/i.test(ev.name ?? "") || ev.status?.type?.name?.includes?.("FULL")) {
        return {
          resolvedEventId: id,
          dateStr,
          league: "soccer/eng.1",
          shortName: comp?.shortName ?? ev.shortName ?? ev.name,
        };
      }
    }
    for (const ev of r.data.events) {
      const id = ev?.id != null ? String(ev.id) : null;
      if (!id || skip.has(id)) continue;
      return {
        resolvedEventId: id,
        dateStr,
        league: "soccer/eng.1",
        shortName: ev.competitions?.[0]?.shortName ?? ev.shortName ?? ev.name,
      };
    }
  }
  return null;
}

async function probeSoccerEng1(opts) {
  const { league, eventId } = opts;
  const scoreboardUrl = `${BASE}/${league}/scoreboard/${eventId}`;
  const summaryUrl = `${BASE}/${league}/summary?event=${eventId}`;

  const sb = await fetchJson(scoreboardUrl);
  if (!sb.ok) return { ok: false, status: sb.status, scoreboardUrl, summaryUrl, error: "scoreboard HTTP" };

  const root = sb.data;
  assert(root.competitions?.length > 0, "scoreboard single-game: competitions missing");
  const comp = root.competitions[0];
  const home = comp.competitors.find((c) => c.homeAway === "home");
  const away = comp.competitors.find((c) => c.homeAway === "away");
  assert(home && away, "home/away competitors");

  const homeScore = pick(root, "competitions[0].competitors[0].score");
  const awayScore = pick(root, "competitions[0].competitors[1].score");
  assert(
    home.homeAway === "home" && away.homeAway === "away",
    "competitors[0/1] must be home/away for Playscript selectors",
  );

  const statusName = pick(root, "competitions[0].status.type.name");
  const yellows = countYellowInDetails(comp.details);
  const reds = countRedInDetails(comp.details);

  const sum = await fetchJson(summaryUrl);
  let htHome;
  let htAway;
  let headerSoccerHalves = sum.ok ? extractSoccerHalvesFromSummary(sum.data) : null;
  let teamStats = [];
  if (sum.ok && sum.data?.boxscore?.teams?.length >= 2) {
    const teams = sum.data.boxscore.teams;
    htHome = teams[0]?.linescores?.[0]?.value;
    htAway = teams[1]?.linescores?.[0]?.value;
    for (let i = 0; i < teams.length; i++) {
      const stats = teams[i]?.statistics;
      const yc = Array.isArray(stats) ? stats.find((s) => s.name === "yellowCards") : null;
      const rc = Array.isArray(stats) ? stats.find((s) => s.name === "redCards") : null;
      teamStats.push({
        homeAway: teams[i]?.homeAway,
        displayName: teams[i]?.team?.displayName,
        yellowCards: yc?.displayValue ?? null,
        redCards: rc?.displayValue ?? null,
        yellowCardsPath: yc
          ? `boxscore.teams[${i}].statistics[${stats.findIndex((s) => s.name === "yellowCards")}].displayValue`
          : null,
        redCardsPath: rc
          ? `boxscore.teams[${i}].statistics[${stats.findIndex((s) => s.name === "redCards")}].displayValue`
          : null,
      });
    }
  }

  return {
    ok: true,
    sport: "soccer",
    league,
    eventId,
    scoreboardUrl,
    summaryUrl,
    final: { home: homeScore, away: awayScore, status: statusName },
    soccerDetails: {
      yellowCardCount: yellows,
      redCardCount: reds,
      detailCount: comp.details?.length ?? 0,
    },
    summaryHalfTimeBoxscoreTeams: { home1H_value: htHome, away1H_value: htAway },
    soccerHalvesFromSummaryHeader: headerSoccerHalves,
    summaryTeamStatistics: sum.ok ? teamStats : [],
    selectors: {
      homeScore: "competitions[0].competitors[0].score",
      awayScore: "competitions[0].competitors[1].score",
      status: "competitions[0].status.type.name",
      homeTeam: "competitions[0].competitors[0].team.displayName",
      awayTeam: "competitions[0].competitors[1].team.displayName",
      htHomeBoxscoreTeams: "boxscore.teams[0].linescores[0].value",
      htAwayBoxscoreTeams: "boxscore.teams[1].linescores[0].value",
      /** Legacy keys — often empty for EPL; use header half displays above. */
      htHome: "boxscore.teams[0].linescores[0].value",
      htAway: "boxscore.teams[1].linescores[0].value",
      /** Typical when summary `competitors[0]` is home (verify per event). */
      htHome_header_1stHalf_display: "header.competitions[0].competitors[0].linescores[0].displayValue",
      htAway_header_1stHalf_display: "header.competitions[0].competitors[1].linescores[0].displayValue",
      htHomeAwayHeaderPairs:
        "alternate: map by homeAway in app; see soccerHalvesFromSummaryHeader",
    },
  };
}

async function resolveMlbEventId(sample) {
  if (sample.eventId) return sample.eventId;
  const url = `${BASE}/${sample.league}/scoreboard?dates=${sample.dateFallback}`;
  const sb = await fetchJson(url);
  if (!sb.ok || !sb.data?.events?.[0]?.id) return null;
  return String(sb.data.events[0].id);
}

async function probeLinescoreSport({ key, league, eventId }) {
  const scoreboardUrl = `${BASE}/${league}/scoreboard/${eventId}`;
  const summaryUrl = `${BASE}/${league}/summary?event=${eventId}`;

  const sb = await fetchJson(scoreboardUrl);
  if (!sb.ok) return { ok: false, key, status: sb.status, scoreboardUrl };

  const comp = sb.data?.competitions?.[0];
  if (!comp) return { ok: false, key, error: "no competitions" };

  const home = comp.competitors.find((c) => c.homeAway === "home");
  const away = comp.competitors.find((c) => c.homeAway === "away");

  /** Per docs: NBA/NFL scoreboard exposes linescores on competitors inline. */
  const homeRows = tidyLinescoreSlice(home?.linescores);
  const awayRows = tidyLinescoreSlice(away?.linescores);
  const hasInlineQs = homeRows.length > 0;

  let halfTotals = null;
  if (key === "nba") {
    const hSum = sliceSum(home?.linescores, 0, 2);
    const aSum = sliceSum(away?.linescores, 0, 2);
    halfTotals =
      hSum != null && aSum != null ? { regulationFirstHalf_home: hSum, regulationFirstHalf_away: aSum } : null;
  }
  if (key === "nfl") {
    const hSum = sliceSum(home?.linescores, 0, 2);
    const aSum = sliceSum(away?.linescores, 0, 2);
    halfTotals =
      hSum != null && aSum != null ? { firstHalf_home: hSum, firstHalf_away: aSum } : null;
  }

  const sum = await fetchJson(summaryUrl);
  let summaryBoxscorePeriodsHomeAway = null;
  if (sum.ok && Array.isArray(sum.data?.boxscore?.teams) && sum.data.boxscore.teams.length >= 2) {
    const tb = sum.data.boxscore.teams;
    summaryBoxscorePeriodsHomeAway = tb.slice(0, 2).map((t, i) => ({
      bucketIndex: i,
      homeAway: t?.homeAway ?? null,
      displayName: t?.team?.displayName ?? null,
      periods: tidyLinescoreSlice(t.linescores),
    }));
  }

  return {
    ok: true,
    key,
    league,
    eventId,
    scoreboardUrl,
    summaryUrl: sum.ok ? summaryUrl : undefined,
    final: { home: home?.score, away: away?.score, status: comp.status?.type?.name },
    scoreboard_period_scores: {
      homeTeam: home?.team?.displayName ?? null,
      awayTeam: away?.team?.displayName ?? null,
      home_periods: homeRows,
      away_periods: awayRows,
      periodCount_home: homeRows.length,
      halfTotals,
    },
    summary_boxscore_team_periods: summaryBoxscorePeriodsHomeAway,
  };
}

async function main() {
  const strict = process.env.ESPN_VERIFY_STRICT === "1";

  console.log("ESPN API offchain verification (espn-api-docs.md)\n");

  const results = { generatedAt: new Date().toISOString(), probes: {} };

  const soccer = await probeSoccerEng1(SAMPLES.soccer_eng1);
  results.probes.soccer_eng1 = soccer;
  if (!soccer.ok) throw new Error(JSON.stringify(soccer));
  console.log(`Soccer EPL (${SAMPLES.soccer_eng1.eventId})`, soccer.final, soccer.soccerDetails);
  console.log("  halves (header summary)", soccer.soccerHalvesFromSummaryHeader?.rawHalfArrays);
  console.log("  boxscore.team half values (often empty everywhere we tested)", soccer.summaryHalfTimeBoxscoreTeams);

  console.log(
    "  Y/R from summary team statistics",
    soccer.summaryTeamStatistics?.map((t) => `${t.displayName}: Y=${t.yellowCards ?? "?"} R=${t.redCards ?? "?"}`),
  );

  const altSoc = await resolveSoccerEng1AltExclude(SAMPLES.soccer_eng1.eventId, SAMPLES.soccer_eng1_alt_dates);
  results.probes.soccer_eng1_alt_meta = altSoc;
  if (altSoc?.resolvedEventId) {
    const soccer2 = await probeSoccerEng1({ league: "soccer/eng.1", eventId: altSoc.resolvedEventId });
    results.probes.soccer_eng1_alt = soccer2;
    console.log("\nSoccer EPL alt", `(event ${altSoc.resolvedEventId}, day ${altSoc.dateStr})`, soccer2.final, soccer2.soccerDetails);
    console.log(
      "  halves (header)",
      soccer2.soccerHalvesFromSummaryHeader?.rawHalfArrays,
      "| boxscore.team 1st",
      soccer2.summaryHalfTimeBoxscoreTeams,
    );
    console.log(
      "  Y/R summary statistics",
      soccer2.summaryTeamStatistics?.map((t) => `${t.displayName}: Y=${t.yellowCards ?? "?"} R=${t.redCards ?? "?"}`),
    );
    if (!soccer2.ok) throw new Error(JSON.stringify(soccer2));
  } else {
    console.warn("\nWARN: could not resolve alternate EPL fixture from dates", SAMPLES.soccer_eng1_alt_dates);
  }

  /** Extra EPL matches: header vs boxscore halves + discipline (summary + single-game scoreboard). */
  const excludeForHalfScan = [
    SAMPLES.soccer_eng1.eventId,
    results.probes.soccer_eng1_alt?.eventId,
    altSoc?.resolvedEventId,
  ].filter(Boolean);
  const halfScanMeta = await resolveSoccerLeagueEventIdsExcluding(
    "soccer/eng.1",
    SAMPLES.soccer_half_source_scan_dates,
    excludeForHalfScan,
    3,
  );
  results.probes.soccer_eng1_half_source_scan = {};
  console.log("\n--- Soccer EPL: header vs boxscore (+ cards) ---");
  for (const meta of halfScanMeta) {
    const d = await diagnoseSoccerHalfSources("soccer/eng.1", meta.eventId);
    results.probes.soccer_eng1_half_source_scan[meta.eventId] = { meta, diagnose: d };
    if (!d.ok) {
      console.warn(`${meta.eventId} summary failed HTTP`, d.summaryHttpStatus);
      continue;
    }
    console.log(`\n${meta.eventId} (${meta.label})`);
    console.log("  verdict:", d.verdict);
    console.log("  final (header competitors):", d.headerFinalScores);
    console.log("  header halves [home[], away[]]:", d.headerHalves?.rawHalfArrays);
    console.log("  boxscore.teams linescores first two (by homeAway):", d.boxscoreTeamsLinescoresByHomeAway);
    logSoccerDisciplineBlock(d);
  }
  if (!halfScanMeta.length) {
    console.warn("WARN: half-source scan found no extra EPL event ids (all excluded or empty scoreboard days)");
  }

  /** Same half-source experiment across other soccer leagues (not only EPL). */
  results.probes.soccer_cross_league_half_probe = {};
  console.log("\n--- Soccer multi-league: halves + discipline (same pattern as EPL) ---");
  for (const row of SAMPLES.soccer_cross_league_half_probe) {
    const meta = await resolveFirstSoccerEventMeta(row.league, row.dates);
    if (!meta) {
      console.warn(`SKIP ${row.key}: no scoreboard events for dates ${row.dates.join(", ")}`);
      results.probes.soccer_cross_league_half_probe[row.key] = {
        ok: false,
        league: row.league,
        datesTried: row.dates,
      };
      continue;
    }
    const d = await diagnoseSoccerHalfSources(row.league, meta.eventId);
    results.probes.soccer_cross_league_half_probe[row.key] = {
      ok: d.ok,
      league: row.league,
      eventMeta: meta,
      diagnose: d,
    };
    if (!d.ok) {
      console.warn(`${row.key} summary HTTP`, d.summaryHttpStatus);
      continue;
    }
    console.log(`\n${row.key} (${row.league}) ${meta.eventId} (${meta.label})`);
    console.log("  verdict:", d.verdict);
    console.log("  final(header):", d.headerFinalScores);
    console.log("  header halves:", d.headerHalves?.rawHalfArrays);
    console.log(
      "  boxscore.teams linescore lens:",
      d.boxscoreTeamsOrder?.map((t) => `${t.homeAway ?? "?"}:${t.linescoreLen}`).join(", ") ?? "?",
    );
    logSoccerDisciplineBlock(d);
  }

  function logPeriodsport(label, sampleId, r) {
    const ps = r.scoreboard_period_scores;
    console.log(`${label} (${sampleId}) final`, r.final);
    console.log(
      `  scoreboard periods home ${ps.homeTeam}:`,
      ps.home_periods.map((x) => x.displayValue ?? x.value ?? "?").join(","),
    );
    console.log(
      `  scoreboard periods away ${ps.awayTeam}:`,
      ps.away_periods.map((x) => x.displayValue ?? x.value ?? "?").join(","),
    );
    if (ps.halfTotals) console.log("  computed half totals", ps.halfTotals);
    if (r.summary_boxscore_team_periods?.length) {
      for (const t of r.summary_boxscore_team_periods) {
        const cells = (t.periods ?? []).map((x) => x.displayValue ?? x.value ?? "?").join(",");
        console.log(`  summary boxscore periods ${t.displayName}:`, cells || "(none)");
      }
    }
  }

  for (const [key, sample] of [
    ["nba", SAMPLES.nba],
    ["nfl", SAMPLES.nfl],
  ]) {
    const r = await probeLinescoreSport({ key, league: sample.league, eventId: sample.eventId });
    results.probes[key] = r;
    if (r.ok) {
      logPeriodsport(key.toUpperCase(), sample.eventId, r);
    } else if (strict) {
      throw new Error(`${key} probe failed: ${JSON.stringify(r)}`);
    } else {
      console.warn(`WARN ${key}: sample stale`);
    }
  }

  const mlbId = await resolveMlbEventId(SAMPLES.mlb);
  if (mlbId) {
    const r = await probeLinescoreSport({ key: "mlb", league: SAMPLES.mlb.league, eventId: mlbId });
    results.probes.mlb = { ...r, resolvedEventId: mlbId, dateFallback: SAMPLES.mlb.dateFallback };
    if (r.ok) logPeriodsport("MLB", mlbId, r);
    else if (strict) throw new Error(`mlb: ${JSON.stringify(r)}`);
    else console.warn("WARN mlb probe", r);
  } else {
    results.probes.mlb = { ok: false, error: "no MLB event from dateFallback" };
    if (strict) throw new Error("MLB could not resolve event id");
    else console.warn("WARN mlb: could not resolve event id");
  }

  /** Hardcoded payloads for Solidity mocks — keep in sync with `EspnJsonApiFetchMocks.sol`. */
  const awayYellow = soccer.summaryTeamStatistics?.find((t) => t.homeAway === "away")?.yellowCardsPath;
  results.mockConstants = {
    soccer_eng1_scoreboard_url: soccer.scoreboardUrl,
    soccer_eng1_summary_url: soccer.summaryUrl,
    selectors_scoreboard_bundle: soccer.selectors,
    soccer_summary_away_yellow_cards_path: awayYellow,
    nba_scoreboard_url: results.probes.nba?.scoreboardUrl,
    nfl_scoreboard_url: results.probes.nfl?.scoreboardUrl,
    mlb_scoreboard_url: results.probes.mlb?.scoreboardUrl,
  };

  writeFileSync(OUT_JSON, JSON.stringify(results, null, 2), "utf8");
  console.log("\nWrote", OUT_JSON);
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
