import type { ScriptSportKey } from "@/lib/fixtures-shared";
import { getScriptSlots, SCRIPT_SPORT_TITLES } from "@/lib/script-slots";

type Props = {
  compact?: boolean;
  /** Defaults to football (soccer) slot copy. */
  sportKey?: ScriptSportKey;
};

export function ScriptSlotsSummary({ compact, sportKey = "soccer" }: Props) {
  const slots = getScriptSlots(sportKey);
  const sportTitle = SCRIPT_SPORT_TITLES[sportKey];

  return (
    <div
      className={
        compact
          ? "border-t border-[var(--border)] bg-[var(--surface)]/60 px-4 py-3"
          : "rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-4 sm:px-5 sm:py-5"
      }
    >
      <p
        className={
          compact
            ? "text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]"
            : "text-xs font-semibold uppercase tracking-wider text-[var(--muted)]"
        }
      >
        Script slots
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
        Five predictions lock into your script before kickoff.
        {sportKey !== "soccer" ? (
          <span className="mt-0.5 block text-[10px] text-[var(--muted)]/90">{sportTitle} pack.</span>
        ) : null}
      </p>
      <ol
        className={
          compact
            ? "mt-2.5 grid list-none grid-cols-1 gap-1.5 text-[11px] leading-snug sm:grid-cols-2 sm:gap-x-4 sm:gap-y-1"
            : "mt-4 grid list-none gap-3 text-sm leading-snug sm:grid-cols-2"
        }
      >
        {slots.map((s) => (
          <li key={s.index} className="flex min-w-0 gap-2">
            <span className="shrink-0 font-mono text-[var(--accent)] tabular-nums">{s.index}.</span>
            <span className="min-w-0 text-[var(--foreground)]">
              <span className="font-medium">{s.title}</span>
              <span className="text-[var(--muted)]"> — {s.outcomes}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
