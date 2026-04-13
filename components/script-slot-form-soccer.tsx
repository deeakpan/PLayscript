"use client";

import Link from "next/link";

import { packSoccerPicks } from "@/lib/playscript-pack-picks";

import { PlayscriptLockScriptButton } from "./playscript-lock-script-button";
import { PlayStakeField } from "./play-stake-field";
import { useCallback, useMemo, useState } from "react";

import { SCRIPT_SLOTS } from "@/lib/script-slots";

const MULT_5 = 3;
const MULT_4 = 1.8;
const MULT_3 = 1.2;

type Winner = "home" | "draw" | "away";
type OverUnder = "over" | "under";
type YesNo = "yes" | "no";

export type ScriptSlotFormBaseProps = {
  homeTeam: string;
  awayTeam: string;
  canEdit: boolean;
  /** On-chain match id from `PlayscriptCore` (fixture section resolves by URL). */
  matchId: number;
  /** Optional packed picks to prefill all 5 slots from a known receipt lookup. */
  prefillPicksPacked?: bigint | null;
};

function HowItWorksTitle({ anchor, children }: { anchor: string; children: React.ReactNode }) {
  return (
    <Link
      href={`/how-it-works#${anchor}`}
      className="font-semibold text-[var(--foreground)] underline decoration-transparent underline-offset-[3px] transition-[color,text-decoration-color] hover:text-[var(--dream-yellow)] hover:decoration-[var(--dream-yellow)]"
    >
      {children}
    </Link>
  );
}

function choiceBtn(active: boolean): string {
  return [
    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
    active
      ? "border-[var(--accent)]/50 bg-[var(--surface-active)] text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      : "border-[var(--border)] bg-[var(--surface)]/90 text-[var(--muted)] hover:border-[var(--dream-yellow)]/35 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
  ].join(" ");
}

function slotFilled(
  step: number,
  w: Winner | null,
  tg: OverUnder | null,
  b: YesNo | null,
  cs: YesNo | null,
  sc: boolean,
): boolean {
  switch (step) {
    case 1:
      return !!w;
    case 2:
      return !!tg;
    case 3:
      return !!b;
    case 4:
      return !!cs;
    case 5:
      return sc;
    default:
      return false;
  }
}

function canAccessStep(
  step: number,
  w: Winner | null,
  tg: OverUnder | null,
  b: YesNo | null,
  cs: YesNo | null,
  sc: boolean,
): boolean {
  if (step === 1) return true;
  for (let i = 1; i < step; i++) {
    if (!slotFilled(i, w, tg, b, cs, sc)) return false;
  }
  return true;
}

export function ScriptSlotFormSoccer({
  homeTeam,
  awayTeam,
  canEdit,
  matchId,
  prefillPicksPacked,
}: ScriptSlotFormBaseProps) {
  const prefill = useMemo(() => {
    if (prefillPicksPacked === null || prefillPicksPacked === undefined) return null;
    const p = prefillPicksPacked;
    const wRaw = Number(p & BigInt(3));
    const winner: Winner | null = wRaw === 0 ? "home" : wRaw === 1 ? "draw" : wRaw === 2 ? "away" : null;
    if (!winner) return null;
    return {
      winner,
      totalGoals: ((p >> BigInt(2)) & BigInt(1)) === BigInt(1) ? ("over" as const) : ("under" as const),
      bts: ((p >> BigInt(3)) & BigInt(1)) === BigInt(1) ? ("yes" as const) : ("no" as const),
      cleanSheet: ((p >> BigInt(4)) & BigInt(1)) === BigInt(1) ? ("yes" as const) : ("no" as const),
      scoreHome: Number((p >> BigInt(8)) & BigInt(255)).toString(),
      scoreAway: Number((p >> BigInt(16)) & BigInt(255)).toString(),
    };
  }, [prefillPicksPacked]);

  const [winner, setWinner] = useState<Winner | null>(prefill?.winner ?? null);
  const [totalGoals, setTotalGoals] = useState<OverUnder | null>(prefill?.totalGoals ?? null);
  const [bts, setBts] = useState<YesNo | null>(prefill?.bts ?? null);
  const [cleanSheet, setCleanSheet] = useState<YesNo | null>(prefill?.cleanSheet ?? null);
  const [scoreHome, setScoreHome] = useState(prefill?.scoreHome ?? "");
  const [scoreAway, setScoreAway] = useState(prefill?.scoreAway ?? "");
  const [playStake, setPlayStake] = useState("");
  const [activeStep, setActiveStep] = useState(prefill ? 5 : 1);

  const scoreComplete = useMemo(() => {
    const h = scoreHome.trim();
    const a = scoreAway.trim();
    if (h === "" || a === "") return false;
    const nh = Number(h);
    const na = Number(a);
    return Number.isInteger(nh) && Number.isInteger(na) && nh >= 0 && na >= 0;
  }, [scoreHome, scoreAway]);

  const filledCount =
    (winner ? 1 : 0) +
    (totalGoals ? 1 : 0) +
    (bts ? 1 : 0) +
    (cleanSheet ? 1 : 0) +
    (scoreComplete ? 1 : 0);

  const disabled = !canEdit;
  const scriptComplete = filledCount === 5;

  const firstIncomplete = useMemo(() => {
    if (!winner) return 1;
    if (!totalGoals) return 2;
    if (!bts) return 3;
    if (!cleanSheet) return 4;
    if (!scoreComplete) return 5;
    return 6;
  }, [winner, totalGoals, bts, cleanSheet, scoreComplete]);

  const goNext = useCallback(() => {
    setActiveStep((s) => Math.min(5, s + 1));
  }, []);

  const winnerLabel =
    winner === "home" ? homeTeam : winner === "away" ? awayTeam : winner === "draw" ? "Draw" : "—";
  const goalsLabel =
    totalGoals === "over" ? "Over 2.5" : totalGoals === "under" ? "Under 2.5" : "—";
  const btsLabel = bts === "yes" ? "Yes" : bts === "no" ? "No" : "—";
  const csLabel = cleanSheet === "yes" ? "Yes" : cleanSheet === "no" ? "No" : "—";
  const scoreLabel =
    scoreComplete && scoreHome.trim() !== "" && scoreAway.trim() !== ""
      ? `${scoreHome.trim()}–${scoreAway.trim()}`
      : "—";

  const stakeNum = useMemo(() => {
    const n = parseFloat(playStake.replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [playStake]);

  const showEstPayout = scriptComplete && stakeNum > 0;
  const fmtPlay = (v: number) =>
    `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} $PLAY`;
  const estPayout5 = showEstPayout ? fmtPlay(stakeNum * MULT_5) : "—";
  const estPayout4 = showEstPayout ? fmtPlay(stakeNum * MULT_4) : "—";
  const estPayout3 = showEstPayout ? fmtPlay(stakeNum * MULT_3) : "—";

  const picksPacked = useMemo(() => {
    if (!winner || !totalGoals || !bts || !cleanSheet || !scoreComplete) return null;
    const ph = Number(scoreHome.trim());
    const pa = Number(scoreAway.trim());
    if (!Number.isInteger(ph) || !Number.isInteger(pa) || ph < 0 || ph > 30 || pa < 0 || pa > 30) {
      return null;
    }
    return packSoccerPicks(winner, totalGoals, bts, cleanSheet, ph, pa);
  }, [winner, totalGoals, bts, cleanSheet, scoreComplete, scoreHome, scoreAway]);

  const formReadyLock = scriptComplete && stakeNum > 0 && picksPacked !== null;

  const stepLabels = ["Winner", "Goals", "Both score", "Clean sheet", "Score"] as const;
  const stepValues = [winnerLabel, goalsLabel, btsLabel, csLabel, scoreLabel];

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="border-b border-[var(--border)] bg-[var(--surface)]/50 px-4 py-3 sm:px-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Build Script
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {disabled
                ? "View only — match already started or closed."
                : "Work through each slot in order. Tap a step you’ve unlocked to jump back."}
            </p>
          </div>

          <div className="border-b border-[var(--border)]/80 px-3 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-0">
              {[1, 2, 3, 4, 5].map((step, idx) => {
                const filled = slotFilled(step, winner, totalGoals, bts, cleanSheet, scoreComplete);
                const accessible = canAccessStep(step, winner, totalGoals, bts, cleanSheet, scoreComplete);
                const active = activeStep === step;
                const segLit =
                  idx < 4 &&
                  slotFilled(step, winner, totalGoals, bts, cleanSheet, scoreComplete);

                return (
                  <div key={step} className="flex min-w-0 flex-1 items-center last:min-w-[2.25rem] last:flex-none">
                    <button
                      type="button"
                      disabled={!canEdit || !accessible}
                      onClick={() => accessible && setActiveStep(step)}
                      className={[
                        "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 font-mono text-xs font-bold tabular-nums transition-all duration-300 sm:h-10 sm:w-10 sm:text-sm",
                        filled
                          ? "border-[var(--accent)]/70 bg-[var(--accent)]/20 text-[var(--accent)] shadow-[0_0_20px_-6px_var(--accent-glow)]"
                          : active
                            ? "border-[var(--dream-yellow)]/60 bg-[var(--surface-active)] text-[var(--dream-yellow)] ring-2 ring-[var(--dream-yellow)]/25"
                            : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]",
                        !canEdit || !accessible ? "cursor-default opacity-50" : "cursor-pointer hover:scale-105",
                      ].join(" ")}
                      aria-current={active ? "step" : undefined}
                      aria-label={`Slot ${step}`}
                    >
                      {filled ? "✓" : step}
                    </button>
                    {idx < 4 ? (
                      <div
                        className={`mx-0.5 h-0.5 min-w-[4px] flex-1 rounded-full transition-colors duration-500 sm:mx-1 ${
                          segLit
                            ? "bg-[var(--accent)]/55 shadow-[0_0_12px_-2px_var(--accent-glow)]"
                            : "bg-[var(--border)]"
                        }`}
                        aria-hidden
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-0 px-4 py-4 sm:px-5 sm:py-5">
            {[1, 2, 3, 4, 5].map((step) => {
              const filled = slotFilled(step, winner, totalGoals, bts, cleanSheet, scoreComplete);
              const isActive = activeStep === step;
              if (!filled && !isActive) return null;

              if (filled && !isActive) {
                return (
                  <button
                    key={`done-${step}`}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => canEdit && setActiveStep(step)}
                    className="flex w-full items-center justify-between gap-3 border-b border-[var(--border)]/60 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-[var(--surface)]/40"
                  >
                    <span className="text-[var(--muted)]">
                      <span className="font-mono text-[var(--accent)]">{step}.</span>{" "}
                      {SCRIPT_SLOTS[step - 1].title}
                    </span>
                    <span className="truncate font-medium text-[var(--foreground)]">
                      {stepValues[step - 1]}
                    </span>
                  </button>
                );
              }

              if (!isActive) return null;

              const def = SCRIPT_SLOTS[step - 1];
              return (
                <div key={`active-${step}`} className="pt-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-sm text-[var(--accent)] tabular-nums">
                      {step}.
                    </span>
                    <h4 className="text-base">
                      <HowItWorksTitle anchor={def.anchor}>{def.title}</HowItWorksTitle>
                    </h4>
                  </div>
                  <p className="mt-1 pl-7 text-sm text-[var(--muted)]">{def.outcomes}</p>

                  <div className="mt-4 pl-0 sm:pl-7">
                    {step === 1 ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            const next = "home" as const;
                            const wasNew = winner !== next;
                            setWinner(next);
                            if (wasNew) goNext();
                          }}
                          className={choiceBtn(winner === "home")}
                        >
                          {homeTeam}
                          <span className="ml-1.5 text-[10px] font-normal uppercase text-[var(--muted)]">
                            home
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            const next = "draw" as const;
                            const wasNew = winner !== next;
                            setWinner(next);
                            if (wasNew) goNext();
                          }}
                          className={choiceBtn(winner === "draw")}
                        >
                          Draw
                        </button>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            const next = "away" as const;
                            const wasNew = winner !== next;
                            setWinner(next);
                            if (wasNew) goNext();
                          }}
                          className={choiceBtn(winner === "away")}
                        >
                          {awayTeam}
                          <span className="ml-1.5 text-[10px] font-normal uppercase text-[var(--muted)]">
                            away
                          </span>
                        </button>
                      </div>
                    ) : null}

                    {step === 2 ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            const next = "over" as const;
                            const wasNew = totalGoals !== next;
                            setTotalGoals(next);
                            if (wasNew) goNext();
                          }}
                          className={choiceBtn(totalGoals === "over")}
                        >
                          Over 2.5
                        </button>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            const next = "under" as const;
                            const wasNew = totalGoals !== next;
                            setTotalGoals(next);
                            if (wasNew) goNext();
                          }}
                          className={choiceBtn(totalGoals === "under")}
                        >
                          Under 2.5
                        </button>
                      </div>
                    ) : null}

                    {step === 3 ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            const next = "yes" as const;
                            const wasNew = bts !== next;
                            setBts(next);
                            if (wasNew) goNext();
                          }}
                          className={choiceBtn(bts === "yes")}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            const next = "no" as const;
                            const wasNew = bts !== next;
                            setBts(next);
                            if (wasNew) goNext();
                          }}
                          className={choiceBtn(bts === "no")}
                        >
                          No
                        </button>
                      </div>
                    ) : null}

                    {step === 4 ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            const next = "yes" as const;
                            const wasNew = cleanSheet !== next;
                            setCleanSheet(next);
                            if (wasNew) goNext();
                          }}
                          className={choiceBtn(cleanSheet === "yes")}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            const next = "no" as const;
                            const wasNew = cleanSheet !== next;
                            setCleanSheet(next);
                            if (wasNew) goNext();
                          }}
                          className={choiceBtn(cleanSheet === "no")}
                        >
                          No
                        </button>
                      </div>
                    ) : null}

                    {step === 5 ? (
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-[var(--muted)]">{homeTeam}</span>
                          <input
                            type="number"
                            min={0}
                            max={30}
                            step={1}
                            inputMode="numeric"
                            disabled={disabled}
                            value={scoreHome}
                            onChange={(e) => setScoreHome(e.target.value)}
                            className="w-24 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm tabular-nums outline-none focus:border-[var(--accent)]/55 focus:ring-1 focus:ring-[var(--accent-glow)] disabled:opacity-50"
                            placeholder="0"
                          />
                        </label>
                        <span className="pb-2 text-sm text-[var(--muted)]">—</span>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium text-[var(--muted)]">{awayTeam}</span>
                          <input
                            type="number"
                            min={0}
                            max={30}
                            step={1}
                            inputMode="numeric"
                            disabled={disabled}
                            value={scoreAway}
                            onChange={(e) => setScoreAway(e.target.value)}
                            className="w-24 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm tabular-nums outline-none focus:border-[var(--accent)]/55 focus:ring-1 focus:ring-[var(--accent-glow)] disabled:opacity-50"
                            placeholder="0"
                          />
                        </label>
                        {scoreComplete ? (
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => goNext()}
                            className="mb-0.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--foreground)]"
                          >
                            Done
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {firstIncomplete <= 5 && !canAccessStep(activeStep, winner, totalGoals, bts, cleanSheet, scoreComplete) ? (
              <p className="pt-2 text-center text-xs text-[var(--muted)]">Unlock earlier steps first.</p>
            ) : null}
          </div>

          <div className="border-t border-[var(--border)]/80 bg-[var(--surface)]/30 px-4 py-2.5 sm:px-5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[var(--muted)]">Slots filled</span>
              <span className="font-mono font-semibold tabular-nums text-[var(--accent)]">
                {filledCount} / 5
              </span>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm text-[var(--muted)]">
          Picks stay in-browser until wallet + <code className="text-[var(--foreground)]">lockScript</code>.
        </p>
      </div>

      <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-72">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Preview</p>
          <dl className="mt-3 space-y-2 text-sm">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-[var(--muted)]">{label}</dt>
                <dd className="max-w-[55%] truncate text-right font-medium text-[var(--foreground)]">
                  {stepValues[i]}
                </dd>
              </div>
            ))}
          </dl>

          <PlayStakeField value={playStake} onChange={setPlayStake} disabled={!canEdit} />

          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Est. payout
            </p>
            <div className="mt-2 space-y-2 text-sm">
              <p className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 tabular-nums">
                <span className="text-[var(--muted)]">
                  5/5 <span className="text-[var(--accent)]">· {MULT_5}×</span>
                </span>
                <span className="font-medium text-[var(--foreground)]">{estPayout5}</span>
              </p>
              <p className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 tabular-nums">
                <span className="text-[var(--muted)]">
                  4/5 <span className="text-[var(--accent)]">· {MULT_4}×</span>
                </span>
                <span className="font-medium text-[var(--foreground)]">{estPayout4}</span>
              </p>
              <p className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 tabular-nums">
                <span className="text-[var(--muted)]">
                  3/5 <span className="text-[var(--accent)]">· {MULT_3}×</span>
                </span>
                <span className="font-medium text-[var(--foreground)]">{estPayout3}</span>
              </p>
            </div>
            {!showEstPayout ? (
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
                {scriptComplete
                  ? "Enter a $PLAY stake to see illustrative amounts."
                  : "Complete all five slots and add a stake to preview."}
              </p>
            ) : null}
            <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
              Gross mint uses <span className="text-[var(--foreground)]">3×</span>,{" "}
              <span className="text-[var(--foreground)]">1.8×</span>, and{" "}
              <span className="text-[var(--foreground)]">1.2×</span> stake for 5/5, 4/5, and 3/5
              correct (before the 5% mint fee). Below 3/5 there is no mint.{" "}
              <Link
                href="/how-it-works"
                className="font-medium text-[var(--accent)] underline-offset-2 transition-colors hover:text-[var(--dream-yellow)] hover:underline"
              >
                Learn more
              </Link>
            </p>
          </div>

          <PlayscriptLockScriptButton
            matchId={matchId}
            picksPacked={picksPacked}
            playStake={playStake}
            formReady={formReadyLock}
            canEdit={canEdit}
          />
          {canEdit && !scriptComplete ? (
            <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
              Finish every slot to enable lock.
            </p>
          ) : null}
          {canEdit && scriptComplete && stakeNum <= 0 ? (
            <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
              Enter a $PLAY stake, then lock onchain.
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
