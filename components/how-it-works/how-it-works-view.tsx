"use client";

import type { ReactNode } from "react";

import { getScriptSlots, SCRIPT_SLOT_PACKS_ORDER, SCRIPT_SPORT_TITLES } from "@/lib/script-slots";

import { useHowItWorksScroll } from "@/components/how-it-works/how-it-works-scroll-context";
import { HowItWorksTocPanel } from "@/components/how-it-works/how-it-works-toc-panel";

const SPORT_KEYS = SCRIPT_SLOT_PACKS_ORDER;

function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-2xl space-y-3 text-sm leading-relaxed text-[var(--muted)] [&_strong]:font-semibold [&_strong]:text-emerald-400/85 [&_code]:rounded-md [&_code]:border [&_code]:border-[var(--border)]/80 [&_code]:bg-[var(--surface)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[11px] [&_code]:text-emerald-200/80">
      {children}
    </div>
  );
}

function SectionBreak() {
  return (
    <div
      className="my-14 w-full border-t-2 border-[var(--border)] opacity-90 sm:my-16"
      aria-hidden
    />
  );
}

function MajorSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="font-[family-name:var(--font-syne),ui-sans-serif,sans-serif] text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function HowItWorksView() {
  const { activeId } = useHowItWorksScroll();

  return (
    <div className="flex flex-col gap-8 md:grid md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-8 lg:gap-10">
      <div className="hidden md:block lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <HowItWorksTocPanel activeId={activeId} />
        </div>
      </div>

      <article className="min-w-0">
        <header className="space-y-4">
          <h1
            id="overview"
            className="font-[family-name:var(--font-syne),ui-sans-serif,sans-serif] scroll-mt-24 text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl"
          >
            How it works
          </h1>
          <Prose>
            <p>
              <strong>Playscript</strong> is a <strong>PROTOCOL</strong> for sports scenarios: you choose
              five outcomes before kickoff, stake <strong>$PLAY</strong>, and the same rules settle everyone
              onchain. The app is a front-end to that protocol — match lists come from{" "}
              <strong>TheSportsDB</strong>; final scores used for grading are whatever the PROTOCOL records
              after <strong>settlement</strong> (see below).
            </p>
          </Prose>
        </header>

        <SectionBreak />

        <MajorSection id="tokens" title="$PLAY & stakes">
          <Prose>
            <p>
              Stakes are in the <strong>PLAY</strong> token ($PLAY in the UI). Before your first lock, the
              PROTOCOL needs a standard ERC-20 allowance to the core contract so it can pull your stake.
              Amounts respect PLAY decimals onchain.
            </p>
            <p>
              Your stake is locked until you <strong>claim</strong> after the match is settled: claiming
              always moves your full stake to the PROTOCOL treasury; winners additionally receive newly
              minted PLAY according to the tier you hit (see Payouts).
            </p>
          </Prose>
        </MajorSection>

        <SectionBreak />

        <MajorSection id="slots" title="Five slots">
          <Prose>
            <p>
              Each script has <strong>exactly five slots</strong>, in order. You complete all five and your
              stake before kickoff. The PROTOCOL allows{" "}
              <strong>one locked script per wallet per match</strong>.
            </p>
            <p>
              Picks are packed into a single onchain value; you get a deterministic{" "}
              <strong>choices receipt</strong> (hash) anyone can verify against <code>matchId</code>, sport,
              and picks.
            </p>
            <p>
              Think of the receipt as your script fingerprint: copy/share it to reopen the same match and
              prefill the same 5 slots in the app, so another user can build a script with the exact same
              options as the original owner (they only re-enter stake before locking). The receipt itself is
              a hash, so it proves picks but does not expose your raw slot choices without the matching packed
              picks data.
            </p>
            <p>
              Slot wording and lines (totals, margins, etc.) depend on the match&apos;s sport — the same
              five indices exist for every sport, but the questions and cutoffs change (see Sports).
            </p>
          </Prose>
        </MajorSection>

        <SectionBreak />

        <MajorSection id="sports" title="How sports differ">
          <Prose>
            <p>
              The PROTOCOL stores a <strong>sport enum</strong> per match: football (soccer), basketball
              (NBA ruleset), American football (NFL ruleset), baseball (MLB ruleset). That choice drives
              which five-slot pack you see in the app and how each slot is graded against the final result.
            </p>
            <p>
              Fixtures in the app are tagged with a sport so you only build scripts that match how that
              league is wired onchain.
            </p>
          </Prose>
        </MajorSection>

        <SectionBreak />

        <MajorSection id="agent" title="Settlement & agent">
          <Prose>
            <p>
              After kickoff and a <strong>finalize delay</strong> defined per match, the match can be{" "}
              <strong>settled</strong>. Settlement is not “someone typing the score in the app.” The
              PROTOCOL issues parallel <strong>JSON API agent</strong> requests against the match&apos;s{" "}
              <strong>TheSportsDB event URL</strong>, using stored selector paths (e.g. where home/away
              scores live in that JSON). When every required field returns successfully, the PROTOCOL writes{" "}
              <strong>final home and away numbers</strong> onchain and marks the match settled.
            </p>
            <p>
              Triggering settlement requires attaching the native <strong>gas/deposit</strong> the agent
              platform charges for those reads (five requests). If any read fails, settlement does not
              complete — the match stays unsettled until a successful retry path exists.
            </p>
            <p>
              <strong>You</strong> don&apos;t run the agent by hand; you only need to know that{" "}
              <strong>grading uses those onchain finals</strong>, not a third-party score widget in the
              app.
            </p>
          </Prose>
        </MajorSection>

        <SectionBreak />

        <MajorSection id="grading" title="Grading">
          <Prose>
            <p>
              Once settled, each slot is checked against the official finals: winner, totals vs the line,
              yes/no props, and (for football) exact score where applicable. You get a count of how many of
              the five you got right — that count alone drives the payout tier, not a separate “ticket
              price.”
            </p>
          </Prose>
        </MajorSection>

        <SectionBreak />

        <MajorSection id="payouts" title="Payouts & claim">
          <Prose>
            <p>
              After settlement, you call <strong>claim</strong> on the PROTOCOL for your script. On every
              claim, your full stake is transferred to the treasury.
            </p>
            <p>
              If you had <strong>3, 4, or 5</strong> slots correct, the PROTOCOL also <strong>mints</strong>{" "}
              PLAY to you and a small mint fee to the treasury: effectively <strong>about 1.2×</strong>,{" "}
              <strong>1.8×</strong>, or <strong>3×</strong> your stake as the gross mint pool for 3/5, 4/5,
              and 5/5 respectively (before the mint fee slice). <strong>Below 3/5</strong> there is no mint
              — you still claim so the stake path completes; you simply receive no extra PLAY for that
              script.
            </p>
          </Prose>
        </MajorSection>

        <SectionBreak />

        <MajorSection id="odds" title="What “odds” means here">
          <Prose>
            <p>
              The app may show <strong>illustrative</strong> amounts when you type a stake — those are{" "}
              <strong>not bookmaker odds</strong>. They are rough multipliers so you can picture 4/5 vs 5/5
              under PROTOCOL rules. Edge cases, rounding, and the mint fee are defined by the contract, not
              the preview text.
            </p>
          </Prose>
        </MajorSection>

        {SPORT_KEYS.map((sportKey) => {
          const slots = getScriptSlots(sportKey);
          const title = SCRIPT_SPORT_TITLES[sportKey];
          return (
            <div key={sportKey}>
              <SectionBreak />
              <section id={`sport-${sportKey}`} className="scroll-mt-24 space-y-6">
                <h2 className="font-[family-name:var(--font-syne),ui-sans-serif,sans-serif] text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">
                  {title}
                </h2>
                <p className="max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
                  Five slots for this pack. Each line is graded against settled finals — same order as in
                  the script builder.
                </p>
                <div className="max-w-2xl divide-y divide-[var(--border)]/90">
                  {slots.map((s) => (
                    <div key={s.anchor} id={s.anchor} className="scroll-mt-24 py-4 first:pt-0">
                      <h3 className="font-[family-name:var(--font-syne),ui-sans-serif,sans-serif] text-lg font-semibold tracking-tight text-[var(--foreground)]">
                        <span className="mr-2 font-mono text-sm tabular-nums text-[var(--accent)]">
                          {s.index}.
                        </span>
                        {s.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{s.outcomes}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          );
        })}
      </article>
    </div>
  );
}
