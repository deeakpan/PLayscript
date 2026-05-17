"use client";

import { useMemo } from "react";

import { partitionVaultPlay, utilizedBps } from "@/lib/vault-utilization";

/** Matches home “Upcoming fixtures” heading (Syne). */
const POOL_UTIL_HEADING =
  "font-[family-name:var(--font-syne),ui-sans-serif,sans-serif] text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl";

type Props = {
  vaultPlayBal: bigint;
  totalOutstandingLiability: bigint;
  freeFloat: bigint;
  hardFloorBps: bigint;
  formatWei: (wei: bigint) => string;
  displayAmount: (raw: string) => string;
};

const SLICES = [
  { key: "liability", label: "Match liability", color: "#e11d48" },
  { key: "hardFloor", label: "Hard floor reserve", color: "#64748b" },
  { key: "freeFloat", label: "Free float (withdraw cap)", color: "#3d8b6e" },
] as const;

function pieSlicePath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const sweep = a1 - a0;
  const largeArc = sweep > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1} Z`;
}

function rowPct(value: bigint, total: bigint): string {
  if (total <= BigInt(0) || value <= BigInt(0)) return "0%";
  return `${(Number((value * BigInt(10000)) / total) / 100).toFixed(2)}%`;
}

export function VaultUtilizationPie({
  vaultPlayBal,
  totalOutstandingLiability,
  freeFloat,
  hardFloorBps,
  formatWei,
  displayAmount,
}: Props) {
  const parts = useMemo(
    () => partitionVaultPlay(vaultPlayBal, totalOutstandingLiability, freeFloat),
    [vaultPlayBal, totalOutstandingLiability, freeFloat],
  );

  const utilPct = useMemo(
    () => utilizedBps(parts.liability, parts.hardFloor, parts.total),
    [parts.liability, parts.hardFloor, parts.total],
  );

  const tvlDisplay = displayAmount(formatWei(parts.total));

  const { paths, legend } = useMemo(() => {
    const total = parts.total;
    const cx = 64;
    const cy = 64;
    const r = 54;
    let angle = -Math.PI / 2;
    const sliceData = [
      { ...SLICES[0], value: parts.liability },
      { ...SLICES[1], value: parts.hardFloor },
      { ...SLICES[2], value: parts.freeFloat },
    ];
    const pathsOut: { d: string; color: string; key: string; label: string }[] = [];
    for (const s of sliceData) {
      if (s.value <= BigInt(0) || total <= BigInt(0)) continue;
      const t = Number(s.value) / Number(total);
      if (!Number.isFinite(t) || t <= 0) continue;
      const da = Math.min(2 * Math.PI, Math.max(t, 1e-15) * 2 * Math.PI);
      const a1 = angle + da;
      pathsOut.push({
        d: pieSlicePath(cx, cy, r, angle, a1),
        color: s.color,
        key: s.key,
        label: s.label,
      });
      angle = a1;
    }
    const legendOut = sliceData.map((s) => ({
      ...s,
      pct: rowPct(s.value, total),
      display: displayAmount(formatWei(s.value)),
    }));
    return { paths: pathsOut, legend: legendOut };
  }, [parts, formatWei, displayAmount]);

  const floorLabel = `${hardFloorBps.toString()} bps of TVL`;

  return (
    <section className="py-1 text-left" aria-label="Pool utilization">
      <h2 className={POOL_UTIL_HEADING}>Pool utilization</h2>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-[var(--muted)]">
        TVL splits into match liability, hard floor ({floorLabel}), and free float (LP withdrawal cap).{" "}
        <span className="font-mono text-[11px] text-[var(--foreground)]">withdraw</span> pays{" "}
        <span className="font-mono text-[11px]">min(pro-rata, freeFloat)</span>. Non-free float:{" "}
        <span className="font-semibold tabular-nums text-amber-200/95">{utilPct.toFixed(2)}%</span>
        <span className="mx-2 text-[var(--border)]">·</span>
        Free float share:{" "}
        <span className="font-semibold tabular-nums text-[var(--accent)]">{rowPct(parts.freeFloat, parts.total)}</span>
      </p>

      <div className="mt-6 grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-10">
        <div className="relative mx-auto aspect-square w-full max-w-[min(13rem,85vw)] sm:max-w-[13rem] lg:mx-0 lg:max-w-[12rem]">
          <svg
            viewBox="0 0 128 128"
            className="h-full w-full drop-shadow-sm"
            role="img"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
          >
            <title>Pool utilization pie chart</title>
            {parts.total <= BigInt(0) ? (
              <circle cx={64} cy={64} r={54} fill="var(--surface-hover)" stroke="var(--border)" />
            ) : paths.length === 0 ? (
              <circle cx={64} cy={64} r={54} fill="var(--surface-hover)" stroke="var(--border)" />
            ) : (
              paths.map((p) => (
                <path key={p.key} d={p.d} fill={p.color} stroke="var(--background)" strokeWidth={1}>
                  <title>{p.label}</title>
                </path>
              ))
            )}
            <circle cx={64} cy={64} r={24} fill="var(--background)" stroke="var(--border)" strokeWidth={1} />
          </svg>
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center"
            aria-hidden
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] sm:text-[11px]">
              TVL
            </span>
            <span
              className="mt-1 max-w-[52%] break-words font-mono text-[clamp(9px,2.4vw,12px)] font-semibold leading-snug text-[var(--foreground)]"
              title={tvlDisplay}
            >
              {tvlDisplay}
            </span>
          </div>
        </div>

        <ul className="min-w-0 w-full space-y-2.5 text-xs sm:space-y-3 sm:text-sm" aria-label="Legend">
          {legend.map((row) => (
            <li key={row.key} className="flex items-start gap-2.5">
              <span
                className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-white/10 sm:h-3 sm:w-3"
                style={{ backgroundColor: row.color }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[var(--foreground)]">{row.label}</div>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[11px] text-[var(--muted)]">
                  <span className="break-all text-[var(--foreground)]">{row.display}</span>
                  <span className="shrink-0">{row.pct}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
