"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { ScriptSportKey } from "@/lib/fixtures-shared";
import {
  bitmaskPopcount,
  difficultyLabel,
  selectV2MarketLegs,
  sumSelectedWeights,
  V2_LEG_COUNT,
  V2_MASK_MAX,
  V2_PICK_COUNT,
  type PlayscriptV2Leg,
} from "@/lib/playscript-v2-legs";

type Props = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  sportKey: ScriptSportKey;
  /** When false, legs are listed but picks are disabled (e.g. kickoff passed or live). */
  picksEnabled: boolean;
  /** Fired whenever the 12-bit leg mask changes (for v2 kernel lock UI). */
  onLegMaskChange?: (legMask12: number) => void;
};

function difficultyPillClass(d: PlayscriptV2Leg["difficulty"]): string {
  switch (d) {
    case "easy":
      return "bg-emerald-500/15 text-emerald-200/95 ring-emerald-500/25";
    case "medium":
      return "bg-amber-500/12 text-amber-100/90 ring-amber-500/22";
    case "hard":
      return "bg-rose-500/12 text-rose-100/90 ring-rose-500/22";
    default:
      return "bg-zinc-500/15 text-zinc-200 ring-zinc-500/25";
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function LegOptionCard({
  children,
  index,
  reducedMotion,
}: {
  children: React.ReactNode;
  index: number;
  reducedMotion: boolean;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const [ioRevealed, setIoRevealed] = useState(false);
  const revealed = reducedMotion || ioRevealed;

  useEffect(() => {
    if (reducedMotion) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setIoRevealed(true);
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reducedMotion]);

  return (
    <li
      ref={ref}
      className={`transform-gpu transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
        revealed ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
      }`}
      style={reducedMotion ? undefined : { transitionDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      {children}
    </li>
  );
}

export function PlayscriptV2LegBuilder({
  fixtureId,
  homeTeam,
  awayTeam,
  sportKey,
  picksEnabled,
  onLegMaskChange,
}: Props) {
  const legs = useMemo(
    () => selectV2MarketLegs(fixtureId, homeTeam, awayTeam, sportKey),
    [fixtureId, homeTeam, awayTeam, sportKey],
  );

  const [mask, setMask] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  const count = useMemo(() => bitmaskPopcount(mask), [mask]);
  const totalWeight = useMemo(() => sumSelectedWeights(legs, mask), [legs, mask]);
  const ready = count === V2_PICK_COUNT;

  const toggle = useCallback(
    (legId: number) => {
      if (!picksEnabled) return;
      const bit = 1 << (legId - 1);
      setMask((prev) => {
        const on = (prev & bit) !== 0;
        if (on) return prev & ~bit;
        if (bitmaskPopcount(prev) >= V2_PICK_COUNT) return prev;
        return (prev | bit) & V2_MASK_MAX;
      });
    },
    [picksEnabled],
  );

  const clear = useCallback(() => {
    if (!picksEnabled) return;
    setMask(0);
  }, [picksEnabled]);

  useLayoutEffect(() => {
    onLegMaskChange?.(mask);
  }, [mask, onLegMaskChange]);

  return (
    <section
      aria-label="Playscript v2 fifteen-leg script builder"
      className="max-w-5xl pb-2"
    >
      <div className="relative grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8">
        <div className="min-w-0 space-y-4 pb-20 lg:col-start-1 lg:row-start-1 lg:pb-2">
          <div className="space-y-1.5">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Fifteen-leg script
            </h3>
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              {V2_LEG_COUNT} propositions (home & away).{" "}
              <span className="font-medium text-[var(--foreground)]">
                {V2_PICK_COUNT}/{V2_LEG_COUNT} to win
              </span>
              — pick exactly {V2_PICK_COUNT}; weights set your script score.
            </p>
            {!picksEnabled ? (
              <p className="text-xs text-amber-200/80">
                Picking disabled (live, finished, or after kickoff). Cards stay for reference.
              </p>
            ) : null}
          </div>

          <ul className="list-none space-y-3 p-0">
            {legs.map((L, i) => {
              const bit = 1 << (L.id - 1);
              const on = (mask & bit) !== 0;
              const atCap = count >= V2_PICK_COUNT && !on;
              const disabled = !picksEnabled || atCap;

              return (
                <LegOptionCard key={L.id} index={i} reducedMotion={reducedMotion}>
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)]/80 bg-[var(--surface)]/30 p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] transition-[border-color,box-shadow,background-color] sm:gap-4 ${
                      picksEnabled
                        ? "hover:border-[var(--accent)]/35 hover:bg-[var(--surface)]/45"
                        : "cursor-default opacity-90"
                    } ${on ? "border-[var(--accent)]/45 bg-[var(--surface-active)]/35 shadow-[0_0_0_1px_rgba(61,139,110,0.18)]" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] disabled:cursor-not-allowed"
                      checked={on}
                      disabled={disabled}
                      onChange={() => toggle(L.id)}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-[var(--accent)]">{L.id}</span>
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${difficultyPillClass(L.difficulty)}`}
                        >
                          {difficultyLabel(L.difficulty)}
                        </span>
                        <span className="text-[10px] tabular-nums text-[var(--muted)]">×{L.weight}</span>
                      </div>
                      <p className="text-sm font-medium leading-snug text-[var(--foreground)]">
                        {L.description}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                        {L.type.replaceAll("_", " ")}
                      </p>
                    </div>
                  </label>
                </LegOptionCard>
              );
            })}
          </ul>

          <div className="rounded-xl border border-[var(--border)]/80 bg-[var(--surface)]/25 px-3 py-2.5 font-mono text-[11px] text-[var(--muted)] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]">
            <span className="text-[var(--foreground)]">Bitmask</span>{" "}
            <span className="text-[var(--accent)]">0x{mask.toString(16).padStart(3, "0")}</span>
            <span className="mx-2 text-[var(--border)]">|</span>
            <span>
              {ready
                ? "Ready to lock with this mask."
                : `${V2_PICK_COUNT}/${V2_LEG_COUNT} to win — pick ${V2_PICK_COUNT} legs.`}
            </span>
          </div>
        </div>

        <aside
          aria-label="Selection summary"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)]/50 bg-[color-mix(in_srgb,var(--background)_88%,transparent)] shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:sticky lg:bottom-auto lg:col-start-2 lg:row-start-1 lg:w-[11rem] lg:shrink-0 lg:self-start lg:border-t-0 lg:bg-transparent lg:shadow-none lg:backdrop-blur-none lg:top-20"
        >
          <div className="mx-auto flex w-full max-w-lg flex-row items-center justify-between gap-3 px-4 py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:mx-0 lg:max-w-none lg:flex-col lg:items-stretch lg:gap-2 lg:rounded-xl lg:border lg:border-[var(--border)]/55 lg:bg-[var(--surface)]/45 lg:p-2.5 lg:pb-2.5 lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex min-w-0 flex-1 flex-row flex-wrap items-center gap-x-2.5 gap-y-1 lg:flex-col lg:items-stretch lg:gap-1.5">
              <div className="flex w-full flex-col gap-0.5">
                <div className="flex items-center justify-between gap-2 tabular-nums lg:gap-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                    Picks
                  </span>
                  <span className="font-mono text-sm font-semibold text-[var(--foreground)]">
                    {count}
                    <span className="font-medium text-[var(--muted)]">/{V2_PICK_COUNT}</span>
                  </span>
                </div>
                <p className="text-[9px] leading-tight text-[var(--muted)] lg:text-center">
                  {V2_PICK_COUNT}/{V2_LEG_COUNT} to win
                </p>
              </div>
              <span className="text-[var(--border)] lg:hidden" aria-hidden>
                ·
              </span>
              <div className="hidden h-px w-full shrink-0 bg-[var(--border)]/40 lg:block" aria-hidden />
              <div className="flex items-center justify-between gap-2 tabular-nums lg:gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                  Weight
                </span>
                <span className="font-mono text-sm font-semibold text-[var(--foreground)]">{totalWeight}</span>
              </div>
            </div>
            {picksEnabled ? (
              <button
                type="button"
                onClick={clear}
                disabled={mask === 0}
                className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium text-[var(--accent)] transition-colors hover:bg-[var(--surface)]/60 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent lg:w-full lg:border lg:border-[var(--border)]/50 lg:bg-[var(--surface)]/25 lg:py-1.5 lg:text-center lg:text-[11px] lg:font-semibold lg:text-[var(--foreground)] lg:hover:border-[var(--accent)]/25 lg:hover:bg-[var(--surface-hover)]"
              >
                Clear
              </button>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
