"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import type { ScriptSportKey } from "@/lib/fixtures-shared";
import {
  overUnderBit,
  packNonSoccerFive,
  yesNoBit,
} from "@/lib/playscript-pack-picks";
import { getScriptSlots } from "@/lib/script-slots";

import { PlayscriptLockScriptButton } from "./playscript-lock-script-button";
import { PlayStakeField } from "./play-stake-field";
import type { ScriptSlotFormBaseProps } from "./script-slot-form-soccer";

const MULT_5 = 3;
const MULT_4 = 1.8;
const MULT_3 = 1.2;

type Winner2 = "home" | "away" | null;
type Winner3 = "home" | "draw" | "away" | null;
type OverUnder = "over" | "under";
type YesNo = "yes" | "no";

function decodeBinaryWinner(wRaw: number): Winner2 {
  if (wRaw === 0) return "home";
  if (wRaw === 1) return "away";
  return null;
}

function decodeTernaryWinner(wRaw: number): Winner3 {
  if (wRaw === 0) return "home";
  if (wRaw === 1) return "away";
  if (wRaw === 2) return "draw";
  return null;
}

function decodeOverUnder(packed: bigint): OverUnder {
  return ((packed >> BigInt(2)) & BigInt(1)) === BigInt(1) ? "over" : "under";
}

function decodeYesNo(packed: bigint, bitIndex: number): YesNo {
  return ((packed >> BigInt(bitIndex)) & BigInt(1)) === BigInt(1) ? "yes" : "no";
}

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

function yesNoPair(
  disabled: boolean,
  value: YesNo | null,
  set: (v: YesNo) => void,
  goNext: () => void,
) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          const next = "yes" as const;
          const wasNew = value !== next;
          set(next);
          if (wasNew) goNext();
        }}
        className={choiceBtn(value === "yes")}
      >
        Yes
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          const next = "no" as const;
          const wasNew = value !== next;
          set(next);
          if (wasNew) goNext();
        }}
        className={choiceBtn(value === "no")}
      >
        No
      </button>
    </div>
  );
}

type FiveState = {
  wFilled: boolean;
  ouFilled: boolean;
  y1: boolean;
  y2: boolean;
  y3: boolean;
};

function slotFilled5(step: number, s: FiveState): boolean {
  switch (step) {
    case 1:
      return s.wFilled;
    case 2:
      return s.ouFilled;
    case 3:
      return s.y1;
    case 4:
      return s.y2;
    case 5:
      return s.y3;
    default:
      return false;
  }
}

function canAccess5(step: number, s: FiveState): boolean {
  if (step === 1) return true;
  for (let i = 1; i < step; i++) {
    if (!slotFilled5(i, s)) return false;
  }
  return true;
}

type ShellProps = Pick<ScriptSlotFormBaseProps, "canEdit" | "matchId"> & {
  disabled: boolean;
  activeStep: number;
  setActiveStep: (n: number) => void;
  filledState: FiveState;
  firstIncomplete: number;
  stepLabels: readonly string[];
  stepValues: string[];
  playStake: string;
  setPlayStake: (v: string) => void;
  scriptComplete: boolean;
  picksPacked: bigint | null;
  children: ReactNode;
};

function ScriptFormShell({
  canEdit,
  matchId,
  disabled,
  activeStep,
  setActiveStep,
  filledState,
  firstIncomplete,
  children,
  stepLabels,
  stepValues,
  playStake,
  setPlayStake,
  scriptComplete,
  picksPacked,
}: ShellProps) {
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
  const formReadyLock = scriptComplete && stakeNum > 0 && picksPacked !== null;

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
                const filled = slotFilled5(step, filledState);
                const accessible = canAccess5(step, filledState);
                const active = activeStep === step;
                const segLit = idx < 4 && slotFilled5(step, filledState);

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
            {children}

            {firstIncomplete <= 5 && !canAccess5(activeStep, filledState) ? (
              <p className="pt-2 text-center text-xs text-[var(--muted)]">Unlock earlier steps first.</p>
            ) : null}
          </div>

          <div className="border-t border-[var(--border)]/80 bg-[var(--surface)]/30 px-4 py-2.5 sm:px-5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[var(--muted)]">Slots filled</span>
              <span className="font-mono font-semibold tabular-nums text-[var(--accent)]">
                {(filledState.wFilled ? 1 : 0) +
                  (filledState.ouFilled ? 1 : 0) +
                  (filledState.y1 ? 1 : 0) +
                  (filledState.y2 ? 1 : 0) +
                  (filledState.y3 ? 1 : 0)}{" "}
                / 5
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
              Enter a $PLAY stake, then lock on-chain.
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

export function ScriptSlotFormBasketball({
  homeTeam,
  awayTeam,
  canEdit,
  matchId,
  prefillPicksPacked,
}: ScriptSlotFormBaseProps) {
  const sportKey: ScriptSportKey = "basketball";
  const slots = getScriptSlots(sportKey);
  const prefill = useMemo(() => {
    if (prefillPicksPacked === null || prefillPicksPacked === undefined) return null;
    const p = prefillPicksPacked;
    const winner = decodeBinaryWinner(Number(p & BigInt(3)));
    if (!winner) return null;
    return {
      winner,
      ptsOu: decodeOverUnder(p),
      both100: decodeYesNo(p, 3),
      c230: decodeYesNo(p, 4),
      margin10: decodeYesNo(p, 5),
    };
  }, [prefillPicksPacked]);
  const [winner, setWinner] = useState<Winner2>(prefill?.winner ?? null);
  const [ptsOu, setPtsOu] = useState<OverUnder | null>(prefill?.ptsOu ?? null);
  const [both100, setBoth100] = useState<YesNo | null>(prefill?.both100 ?? null);
  const [c230, setC230] = useState<YesNo | null>(prefill?.c230 ?? null);
  const [margin10, setMargin10] = useState<YesNo | null>(prefill?.margin10 ?? null);
  const [playStake, setPlayStake] = useState("");
  const [activeStep, setActiveStep] = useState(prefill ? 5 : 1);

  const filledState: FiveState = {
    wFilled: !!winner,
    ouFilled: !!ptsOu,
    y1: !!both100,
    y2: !!c230,
    y3: !!margin10,
  };

  const scriptComplete =
    filledState.wFilled &&
    filledState.ouFilled &&
    filledState.y1 &&
    filledState.y2 &&
    filledState.y3;

  const firstIncomplete = useMemo(() => {
    if (!winner) return 1;
    if (!ptsOu) return 2;
    if (!both100) return 3;
    if (!c230) return 4;
    if (!margin10) return 5;
    return 6;
  }, [winner, ptsOu, both100, c230, margin10]);

  const goNext = useCallback(() => {
    setActiveStep((s) => Math.min(5, s + 1));
  }, []);

  const disabled = !canEdit;

  const winnerLabel =
    winner === "home" ? homeTeam : winner === "away" ? awayTeam : "—";
  const ouLabel =
    ptsOu === "over" ? "Over 220.5" : ptsOu === "under" ? "Under 220.5" : "—";
  const y = (v: YesNo | null) => (v === "yes" ? "Yes" : v === "no" ? "No" : "—");
  const stepLabels = ["Winner", "O/U 220.5", "100+", "230+", "10+ pt"] as const;
  const stepValues = [winnerLabel, ouLabel, y(both100), y(c230), y(margin10)];

  const picksPacked = useMemo(() => {
    if (!winner || !ptsOu || !both100 || !c230 || !margin10) return null;
    const w = (winner === "home" ? 0 : 1) as 0 | 1 | 2;
    return packNonSoccerFive(
      w,
      overUnderBit(ptsOu),
      yesNoBit(both100),
      yesNoBit(c230),
      yesNoBit(margin10),
    );
  }, [winner, ptsOu, both100, c230, margin10]);

  const childrenSteps = [1, 2, 3, 4, 5].map((step) => {
    const filled = slotFilled5(step, filledState);
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
            {slots[step - 1].title}
          </span>
          <span className="truncate font-medium text-[var(--foreground)]">{stepValues[step - 1]}</span>
        </button>
      );
    }

    if (!isActive) return null;

    const def = slots[step - 1];
    return (
      <div key={`active-${step}`} className="pt-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm text-[var(--accent)] tabular-nums">{step}.</span>
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
                <span className="ml-1.5 text-[10px] font-normal uppercase text-[var(--muted)]">home</span>
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
                <span className="ml-1.5 text-[10px] font-normal uppercase text-[var(--muted)]">away</span>
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
                  const wasNew = ptsOu !== next;
                  setPtsOu(next);
                  if (wasNew) goNext();
                }}
                className={choiceBtn(ptsOu === "over")}
              >
                Over 220.5
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  const next = "under" as const;
                  const wasNew = ptsOu !== next;
                  setPtsOu(next);
                  if (wasNew) goNext();
                }}
                className={choiceBtn(ptsOu === "under")}
              >
                Under 220.5
              </button>
            </div>
          ) : null}
          {step === 3 ? yesNoPair(disabled, both100, setBoth100, goNext) : null}
          {step === 4 ? yesNoPair(disabled, c230, setC230, goNext) : null}
          {step === 5 ? yesNoPair(disabled, margin10, setMargin10, goNext) : null}
        </div>
      </div>
    );
  });

  return (
    <ScriptFormShell
      canEdit={canEdit}
      matchId={matchId}
      disabled={disabled}
      activeStep={activeStep}
      setActiveStep={setActiveStep}
      filledState={filledState}
      firstIncomplete={firstIncomplete}
      stepLabels={stepLabels}
      stepValues={[...stepValues]}
      playStake={playStake}
      setPlayStake={setPlayStake}
      scriptComplete={scriptComplete}
      picksPacked={picksPacked}
    >
      {childrenSteps}
    </ScriptFormShell>
  );
}

export function ScriptSlotFormBaseball({
  homeTeam,
  awayTeam,
  canEdit,
  matchId,
  prefillPicksPacked,
}: ScriptSlotFormBaseProps) {
  const sportKey: ScriptSportKey = "baseball";
  const slots = getScriptSlots(sportKey);
  const prefill = useMemo(() => {
    if (prefillPicksPacked === null || prefillPicksPacked === undefined) return null;
    const p = prefillPicksPacked;
    const winner = decodeBinaryWinner(Number(p & BigInt(3)));
    if (!winner) return null;
    return {
      winner,
      runsOu: decodeOverUnder(p),
      both3: decodeYesNo(p, 3),
      c10: decodeYesNo(p, 4),
      margin3: decodeYesNo(p, 5),
    };
  }, [prefillPicksPacked]);
  const [winner, setWinner] = useState<Winner2>(prefill?.winner ?? null);
  const [runsOu, setRunsOu] = useState<OverUnder | null>(prefill?.runsOu ?? null);
  const [both3, setBoth3] = useState<YesNo | null>(prefill?.both3 ?? null);
  const [c10, setC10] = useState<YesNo | null>(prefill?.c10 ?? null);
  const [margin3, setMargin3] = useState<YesNo | null>(prefill?.margin3 ?? null);
  const [playStake, setPlayStake] = useState("");
  const [activeStep, setActiveStep] = useState(prefill ? 5 : 1);

  const filledState: FiveState = {
    wFilled: !!winner,
    ouFilled: !!runsOu,
    y1: !!both3,
    y2: !!c10,
    y3: !!margin3,
  };

  const scriptComplete =
    filledState.wFilled &&
    filledState.ouFilled &&
    filledState.y1 &&
    filledState.y2 &&
    filledState.y3;

  const firstIncomplete = useMemo(() => {
    if (!winner) return 1;
    if (!runsOu) return 2;
    if (!both3) return 3;
    if (!c10) return 4;
    if (!margin3) return 5;
    return 6;
  }, [winner, runsOu, both3, c10, margin3]);

  const goNext = useCallback(() => {
    setActiveStep((s) => Math.min(5, s + 1));
  }, []);

  const disabled = !canEdit;

  const winnerLabel =
    winner === "home" ? homeTeam : winner === "away" ? awayTeam : "—";
  const ouLabel =
    runsOu === "over" ? "Over 8.5" : runsOu === "under" ? "Under 8.5" : "—";
  const y = (v: YesNo | null) => (v === "yes" ? "Yes" : v === "no" ? "No" : "—");
  const stepLabels = ["Winner", "O/U 8.5", "3+ each", "10+ runs", "3+ margin"] as const;
  const stepValues = [winnerLabel, ouLabel, y(both3), y(c10), y(margin3)];

  const picksPacked = useMemo(() => {
    if (!winner || !runsOu || !both3 || !c10 || !margin3) return null;
    const w = (winner === "home" ? 0 : 1) as 0 | 1 | 2;
    return packNonSoccerFive(
      w,
      overUnderBit(runsOu),
      yesNoBit(both3),
      yesNoBit(c10),
      yesNoBit(margin3),
    );
  }, [winner, runsOu, both3, c10, margin3]);

  const childrenSteps = [1, 2, 3, 4, 5].map((step) => {
    const filled = slotFilled5(step, filledState);
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
            {slots[step - 1].title}
          </span>
          <span className="truncate font-medium text-[var(--foreground)]">{stepValues[step - 1]}</span>
        </button>
      );
    }

    if (!isActive) return null;

    const def = slots[step - 1];
    return (
      <div key={`active-${step}`} className="pt-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm text-[var(--accent)] tabular-nums">{step}.</span>
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
                <span className="ml-1.5 text-[10px] font-normal uppercase text-[var(--muted)]">home</span>
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
                <span className="ml-1.5 text-[10px] font-normal uppercase text-[var(--muted)]">away</span>
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
                  const wasNew = runsOu !== next;
                  setRunsOu(next);
                  if (wasNew) goNext();
                }}
                className={choiceBtn(runsOu === "over")}
              >
                Over 8.5
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  const next = "under" as const;
                  const wasNew = runsOu !== next;
                  setRunsOu(next);
                  if (wasNew) goNext();
                }}
                className={choiceBtn(runsOu === "under")}
              >
                Under 8.5
              </button>
            </div>
          ) : null}
          {step === 3 ? yesNoPair(disabled, both3, setBoth3, goNext) : null}
          {step === 4 ? yesNoPair(disabled, c10, setC10, goNext) : null}
          {step === 5 ? yesNoPair(disabled, margin3, setMargin3, goNext) : null}
        </div>
      </div>
    );
  });

  return (
    <ScriptFormShell
      canEdit={canEdit}
      matchId={matchId}
      disabled={disabled}
      activeStep={activeStep}
      setActiveStep={setActiveStep}
      filledState={filledState}
      firstIncomplete={firstIncomplete}
      stepLabels={stepLabels}
      stepValues={[...stepValues]}
      playStake={playStake}
      setPlayStake={setPlayStake}
      scriptComplete={scriptComplete}
      picksPacked={picksPacked}
    >
      {childrenSteps}
    </ScriptFormShell>
  );
}

export function ScriptSlotFormNfl({
  homeTeam,
  awayTeam,
  canEdit,
  matchId,
  prefillPicksPacked,
}: ScriptSlotFormBaseProps) {
  const sportKey: ScriptSportKey = "american_football";
  const slots = getScriptSlots(sportKey);
  const prefill = useMemo(() => {
    if (prefillPicksPacked === null || prefillPicksPacked === undefined) return null;
    const p = prefillPicksPacked;
    const winner = decodeTernaryWinner(Number(p & BigInt(3)));
    if (!winner) return null;
    return {
      winner,
      ptsOu: decodeOverUnder(p),
      both20: decodeYesNo(p, 3),
      c50: decodeYesNo(p, 4),
      margin10: decodeYesNo(p, 5),
    };
  }, [prefillPicksPacked]);
  const [winner, setWinner] = useState<Winner3>(prefill?.winner ?? null);
  const [ptsOu, setPtsOu] = useState<OverUnder | null>(prefill?.ptsOu ?? null);
  const [both20, setBoth20] = useState<YesNo | null>(prefill?.both20 ?? null);
  const [c50, setC50] = useState<YesNo | null>(prefill?.c50 ?? null);
  const [margin10, setMargin10] = useState<YesNo | null>(prefill?.margin10 ?? null);
  const [playStake, setPlayStake] = useState("");
  const [activeStep, setActiveStep] = useState(prefill ? 5 : 1);

  const filledState: FiveState = {
    wFilled: !!winner,
    ouFilled: !!ptsOu,
    y1: !!both20,
    y2: !!c50,
    y3: !!margin10,
  };

  const scriptComplete =
    filledState.wFilled &&
    filledState.ouFilled &&
    filledState.y1 &&
    filledState.y2 &&
    filledState.y3;

  const firstIncomplete = useMemo(() => {
    if (!winner) return 1;
    if (!ptsOu) return 2;
    if (!both20) return 3;
    if (!c50) return 4;
    if (!margin10) return 5;
    return 6;
  }, [winner, ptsOu, both20, c50, margin10]);

  const goNext = useCallback(() => {
    setActiveStep((s) => Math.min(5, s + 1));
  }, []);

  const disabled = !canEdit;

  const winnerLabel =
    winner === "home" ? homeTeam : winner === "away" ? awayTeam : winner === "draw" ? "Tie" : "—";
  const ouLabel =
    ptsOu === "over" ? "Over 43.5" : ptsOu === "under" ? "Under 43.5" : "—";
  const y = (v: YesNo | null) => (v === "yes" ? "Yes" : v === "no" ? "No" : "—");
  const stepLabels = ["Result", "O/U 43.5", "20+", "50+", "10+ pt"] as const;
  const stepValues = [winnerLabel, ouLabel, y(both20), y(c50), y(margin10)];

  const picksPacked = useMemo(() => {
    if (!winner || !ptsOu || !both20 || !c50 || !margin10) return null;
    const w = (winner === "home" ? 0 : winner === "away" ? 1 : 2) as 0 | 1 | 2;
    return packNonSoccerFive(
      w,
      overUnderBit(ptsOu),
      yesNoBit(both20),
      yesNoBit(c50),
      yesNoBit(margin10),
    );
  }, [winner, ptsOu, both20, c50, margin10]);

  const childrenSteps = [1, 2, 3, 4, 5].map((step) => {
    const filled = slotFilled5(step, filledState);
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
            {slots[step - 1].title}
          </span>
          <span className="truncate font-medium text-[var(--foreground)]">{stepValues[step - 1]}</span>
        </button>
      );
    }

    if (!isActive) return null;

    const def = slots[step - 1];
    return (
      <div key={`active-${step}`} className="pt-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm text-[var(--accent)] tabular-nums">{step}.</span>
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
                <span className="ml-1.5 text-[10px] font-normal uppercase text-[var(--muted)]">home</span>
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
                Tie
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
                <span className="ml-1.5 text-[10px] font-normal uppercase text-[var(--muted)]">away</span>
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
                  const wasNew = ptsOu !== next;
                  setPtsOu(next);
                  if (wasNew) goNext();
                }}
                className={choiceBtn(ptsOu === "over")}
              >
                Over 43.5
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  const next = "under" as const;
                  const wasNew = ptsOu !== next;
                  setPtsOu(next);
                  if (wasNew) goNext();
                }}
                className={choiceBtn(ptsOu === "under")}
              >
                Under 43.5
              </button>
            </div>
          ) : null}
          {step === 3 ? yesNoPair(disabled, both20, setBoth20, goNext) : null}
          {step === 4 ? yesNoPair(disabled, c50, setC50, goNext) : null}
          {step === 5 ? yesNoPair(disabled, margin10, setMargin10, goNext) : null}
        </div>
      </div>
    );
  });

  return (
    <ScriptFormShell
      canEdit={canEdit}
      matchId={matchId}
      disabled={disabled}
      activeStep={activeStep}
      setActiveStep={setActiveStep}
      filledState={filledState}
      firstIncomplete={firstIncomplete}
      stepLabels={stepLabels}
      stepValues={[...stepValues]}
      playStake={playStake}
      setPlayStake={setPlayStake}
      scriptComplete={scriptComplete}
      picksPacked={picksPacked}
    >
      {childrenSteps}
    </ScriptFormShell>
  );
}
