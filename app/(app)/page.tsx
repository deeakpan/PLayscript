"use client";

import { CalendarBlank, CaretRight, MagnifyingGlass } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { FixtureTableRow } from "@/components/fixture-table-row";
import { LeagueSelect } from "@/components/league-select";
import {
  ALL_LEAGUES_ID,
  buildFixtureDetailHref,
  type FixtureRow,
  getLeaguePickerOptions,
  isScriptSportKey,
  type MatchStatus,
  type ScriptSportKey,
  SPORT_OPTIONS,
} from "@/lib/fixtures-shared";
import { deriveDisplayMatchStatus, matchInferenceWindowMs } from "@/lib/fixture-display-status";

function filterMatches(matches: FixtureRow[], query: string): FixtureRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return matches;
  return matches.filter(
    (m) =>
      m.home.toLowerCase().includes(q) ||
      m.away.toLowerCase().includes(q) ||
      m.league.toLowerCase().includes(q),
  );
}

function statusLabel(s: MatchStatus): string {
  switch (s) {
    case "open":
      return "Scheduled";
    case "closing_soon":
      return "Postponed";
    case "live":
      return "Live";
    case "finished":
      return "Finished";
    default:
      return s;
  }
}

function statusClass(s: MatchStatus): string {
  switch (s) {
    case "open":
      return "bg-zinc-500/15 text-zinc-200 ring-zinc-500/25";
    case "closing_soon":
      return "bg-amber-500/12 text-amber-200/90 ring-amber-500/20";
    case "live":
      return "bg-rose-500/12 text-rose-200/90 ring-rose-500/20";
    case "finished":
      return "bg-zinc-500/15 text-zinc-300 ring-zinc-500/20";
    default:
      return "";
  }
}

function formatKickoffUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(d);
}

function formatTimeUntilKickoff(iso: string, nowMs: number, sportKey: ScriptSportKey): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const sinceKickoff = nowMs - t;
  const endedAfterMs = matchInferenceWindowMs(sportKey);
  if (sinceKickoff >= endedAfterMs) return "Ended";
  if (sinceKickoff >= 0) return "Started";
  const diff = t - nowMs;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const d = Math.floor(hr / 24);
  if (d >= 1) return `${d}d ${hr % 24}h`;
  if (hr >= 1) return `${hr}h ${min % 60}m`;
  if (min >= 1) return `${min}m`;
  return "< 1m";
}

function StatusBadge({ status }: { status: MatchStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClass(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function TeamNames({
  home,
  away,
  className = "",
}: {
  home: string;
  away: string;
  className?: string;
}) {
  return (
    <span className={className}>
      <span className="font-medium text-[var(--team-text)]">{home}</span>{" "}
      <span className="font-medium text-[var(--accent)]">vs</span>{" "}
      <span className="font-medium text-[var(--team-text)]">{away}</span>
    </span>
  );
}

function MatchCard({
  m,
  nowMs,
  listLeagueId,
}: {
  m: FixtureRow;
  nowMs: number;
  listLeagueId: string;
}) {
  const href = buildFixtureDetailHref(m.id, listLeagueId, m.sourceLeagueId);
  const untilKickoff = formatTimeUntilKickoff(m.kickoffUtc, nowMs, m.sportKey);
  const displayStatus = deriveDisplayMatchStatus(
    m.status,
    new Date(m.kickoffUtc).getTime(),
    nowMs,
    m.sportKey,
  );
  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] transition-[border-color,box-shadow] hover:border-[var(--dream-yellow)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
      aria-label={`${m.home} versus ${m.away}. ${untilKickoff} until kickoff or ended. Open fixture for details.`}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-medium leading-snug tracking-tight">
            <span className="flex flex-col gap-0.5">
              <span className="text-[var(--team-text)]">{m.home}</span>
              <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--accent)]">
                vs
              </span>
              <span className="text-[var(--team-text)]">{m.away}</span>
            </span>
          </h3>
          <p className="mt-1.5 text-xs font-medium text-[var(--muted)]">{m.league}</p>
        </div>
        <div className="shrink-0 text-right">
          <StatusBadge status={displayStatus} />
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Time</p>
          <p className="mt-1 text-sm font-semibold tabular-nums leading-snug text-[var(--foreground)]">
            {untilKickoff}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface)]/80 px-4 py-2.5 text-xs text-[var(--muted)]">
        <span>Kickoff, countdown & script slots</span>
        <CaretRight
          className="h-4 w-4 shrink-0 text-[var(--accent)] transition-transform group-hover:translate-x-0.5"
          weight="bold"
          aria-hidden
        />
      </div>
    </Link>
  );
}

export default function HomePage() {
  const [sportKey, setSportKey] = useState<ScriptSportKey>("soccer");
  const [leagueId, setLeagueId] = useState(ALL_LEAGUES_ID);
  const [query, setQuery] = useState("");
  const [fixtures, setFixtures] = useState<FixtureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const sportPickerOptions = useMemo(
    () => SPORT_OPTIONS.map((s) => ({ id: s.id, label: s.label })),
    [],
  );

  const leaguePickerOptions = useMemo(
    () => getLeaguePickerOptions(sportKey),
    [sportKey],
  );

  const onSportChange = (id: string) => {
    if (!isScriptSportKey(id)) return;
    setSportKey(id);
    setLeagueId(ALL_LEAGUES_ID);
  };

  useEffect(() => {
    const allowed = new Set(leaguePickerOptions.map((o) => o.id));
    if (!allowed.has(leagueId)) setLeagueId(ALL_LEAGUES_ID);
  }, [leaguePickerOptions, leagueId]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(
      `/api/fixtures?sport=${encodeURIComponent(sportKey)}&leagueId=${encodeURIComponent(leagueId)}`,
    )
      .then(async (r) => {
        const body = (await r.json()) as { fixtures?: FixtureRow[]; error?: string };
        if (!r.ok) throw new Error(body.error ?? r.statusText);
        return body.fixtures ?? [];
      })
      .then((rows) => {
        if (!cancelled) setFixtures(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setFixtures([]);
          setError(e instanceof Error ? e.message : "Failed to load fixtures");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sportKey, leagueId]);

  const filtered = useMemo(() => filterMatches(fixtures, query), [fixtures, query]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
          Upcoming fixtures
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Next matches from TheSportsDB. Kickoffs are shown in{" "}
          <span className="text-[var(--foreground)]">UTC</span> (API times treated
          as GMT/UTC wall clock).
        </p>
      </div>

      <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="mx-auto w-full max-w-xl sm:mx-0 sm:min-w-0 sm:flex-1">
          <label className="group flex cursor-text items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--search-bar-bg)] px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,box-shadow] duration-200 focus-within:border-[var(--accent)]/55 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_var(--accent-glow),0_0_16px_-4px_var(--accent-glow)]">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--search-icon-bg)] ring-1 ring-white/[0.06]"
              aria-hidden
            >
              <MagnifyingGlass
                className="h-5 w-5 text-white"
                weight="regular"
              />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teams and leagues…"
              className="min-w-0 flex-1 bg-transparent pr-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--search-placeholder)]"
              aria-label="Search matches"
              autoComplete="off"
            />
          </label>
        </div>

        <div className="flex w-full flex-col gap-4 sm:ml-auto sm:mr-3 sm:w-auto sm:shrink-0 sm:flex-row sm:items-end sm:justify-end">
          <LeagueSelect
            showLabel
            label="Sport"
            options={sportPickerOptions}
            value={sportKey}
            onChange={onSportChange}
          />
          <LeagueSelect
            showLabel
            label="League"
            options={leaguePickerOptions}
            value={leagueId}
            onChange={setLeagueId}
          />
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[var(--muted)]">
          Loading fixtures…
        </p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-rose-300/90">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--muted)]">
          No upcoming matches for this sport or league, or nothing matches your search.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-4 md:hidden">
            {filtered.map((m) => (
              <MatchCard
                key={m.sourceLeagueId ? `${m.sourceLeagueId}-${m.id}` : m.id}
                m={m}
                nowMs={nowMs}
                listLeagueId={leagueId}
              />
            ))}
          </div>

          <div className="hidden md:block">
            <div className="relative rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <div
                className="max-h-[min(32rem,calc(100dvh-12rem))] overflow-auto overscroll-contain [-ms-overflow-style:none]"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <table className="w-full min-w-[52rem] table-fixed border-collapse text-left text-sm">
                  <colgroup>
                    <col className="w-[26%]" />
                    <col className="w-[18%]" />
                    <col className="w-[12%]" />
                    <col className="w-[22%]" />
                    <col className="w-[14%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-[var(--border)] bg-[var(--surface-elevated)] text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] shadow-[0_1px_0_0_var(--border)]">
                      <th scope="col" className="px-4 py-3.5 align-bottom font-semibold">
                        Fixture
                      </th>
                      <th scope="col" className="px-4 py-3.5 align-bottom font-semibold">
                        League
                      </th>
                      <th scope="col" className="px-4 py-3.5 align-bottom font-semibold">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3.5 align-bottom font-semibold">
                        Kickoff (UTC)
                      </th>
                      <th scope="col" className="px-4 py-3.5 align-bottom font-semibold">
                        Until kickoff
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filtered.map((m) => (
                      <FixtureTableRow
                        key={m.sourceLeagueId ? `${m.sourceLeagueId}-${m.id}` : m.id}
                        href={buildFixtureDetailHref(m.id, leagueId, m.sourceLeagueId)}
                      >
                        <td className="min-w-0 px-4 py-4 align-middle">
                          <p className="break-words text-sm font-medium leading-snug">
                            <TeamNames home={m.home} away={m.away} />
                          </p>
                          <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)] group-hover:text-[var(--foreground)]/80">
                            5 slots — open row for full list
                          </p>
                        </td>
                        <td className="min-w-0 px-4 py-4 align-middle break-words text-[var(--muted)]">
                          {m.league}
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <StatusBadge
                            status={deriveDisplayMatchStatus(
                              m.status,
                              new Date(m.kickoffUtc).getTime(),
                              nowMs,
                              m.sportKey,
                            )}
                          />
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <div className="flex items-center gap-2">
                            <CalendarBlank
                              className="h-4 w-4 shrink-0 text-[var(--muted)]"
                              weight="regular"
                            />
                            <span className="leading-snug text-[var(--foreground)]">
                              {formatKickoffUtc(m.kickoffUtc)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <span className="font-medium tabular-nums text-[var(--foreground)]">
                            {formatTimeUntilKickoff(m.kickoffUtc, nowMs, m.sportKey)}
                          </span>
                        </td>
                      </FixtureTableRow>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
