import Link from "next/link";

import {
  getScriptSlots,
  SCRIPT_SLOT_PACKS_ORDER,
  SCRIPT_SPORT_TITLES,
} from "@/lib/script-slots";

export default function HowItWorksPage() {
  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/"
          className="text-xs font-medium uppercase tracking-wider text-[var(--muted)] underline-offset-4 hover:text-[var(--foreground)] hover:underline"
        >
          ← Matches
        </Link>
        <h1
          id="overview"
          className="mt-3 scroll-mt-24 text-2xl font-semibold tracking-tight text-[var(--foreground)]"
        >
          How it works
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          Protocol rules, slot grading, and payout tiers — full write-up coming soon. Slot definitions
          depend on the match&apos;s sport (football, basketball, American football, baseball).
        </p>
      </div>

      {SCRIPT_SLOT_PACKS_ORDER.map((sportKey) => {
        const slots = getScriptSlots(sportKey);
        const title = SCRIPT_SPORT_TITLES[sportKey];
        return (
          <section key={sportKey} className="space-y-4 border-t border-[var(--border)] pt-10">
            <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">{title}</h2>
            <ol className="list-none space-y-6">
              {slots.map((s) => (
                <li
                  key={s.anchor}
                  id={s.anchor}
                  className="scroll-mt-24 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4"
                >
                  <p className="font-mono text-xs text-[var(--accent)] tabular-nums">{s.index}.</p>
                  <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">{s.title}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{s.outcomes}</p>
                  <p className="mt-3 text-sm italic text-[var(--muted)]">Details TBD.</p>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
