"use client";

import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { Fragment, useEffect, useRef, useState } from "react";

import type { LeagueOption } from "@/lib/fixtures-shared";

type Props = {
  options: LeagueOption[];
  value: string;
  onChange: (id: string) => void;
  /** Shown above the control when `showLabel` is true (e.g. Sport vs League). */
  label?: string;
  showLabel?: boolean;
  /** Narrow control for filter bars (e.g. fixtures table on mobile). */
  compact?: boolean;
};

export function LeagueSelect({
  options,
  value,
  onChange,
  label = "League",
  showLabel = false,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.id === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const rootClass = compact
    ? "flex w-full min-w-0 flex-col gap-1.5"
    : "flex w-full max-w-[min(100%,11rem)] min-w-0 flex-col gap-1.5 sm:max-w-none";

  const labelClass =
    "text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]";

  const buttonClass = compact
    ? "flex w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-left text-sm text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,box-shadow,background-color] hover:border-[var(--dream-yellow)]/35 hover:bg-[var(--surface-hover)] focus:border-[var(--accent)]/55 focus:outline-none focus:ring-1 focus:ring-[var(--accent-glow)] sm:max-w-[12rem]"
    : "flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left text-sm text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,box-shadow,background-color] hover:border-[var(--dream-yellow)]/35 hover:bg-[var(--surface-hover)] focus:border-[var(--accent)]/55 focus:outline-none focus:ring-1 focus:ring-[var(--accent-glow)] sm:min-w-[14rem] sm:w-auto";

  const menuClass = compact
    ? "absolute left-0 top-full z-50 mt-1 min-w-[max(100%,12rem)] max-h-60 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg ring-1 ring-black/20"
    : "absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg ring-1 ring-black/20";

  const optionClass = compact ? "px-3 py-2.5 text-sm" : "px-3 py-2.5 text-sm";
  const caretClass = "h-4 w-4";

  return (
    <div className={rootClass}>
      {showLabel ? <span className={labelClass}>{label}</span> : null}
      <div ref={rootRef} className="relative min-w-0">
        <button
          type="button"
          aria-label={label}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={buttonClass}
        >
          <span className="min-w-0 truncate font-medium">{current?.label ?? "—"}</span>
          {open ? (
            <CaretUp className={`${caretClass} shrink-0 text-[var(--muted)]`} weight="regular" />
          ) : (
            <CaretDown className={`${caretClass} shrink-0 text-[var(--muted)]`} weight="regular" />
          )}
        </button>

        {open ? (
          <ul role="listbox" aria-activedescendant={value} className={menuClass}>
            {options.map((opt, i) => {
              const selected = opt.id === value;
              const prev = options[i - 1];
              const showHeading = Boolean(opt.group && opt.group !== prev?.group);
              return (
                <Fragment key={opt.id}>
                  {showHeading ? (
                    <li
                      role="presentation"
                      className="pointer-events-none select-none px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]/90"
                    >
                      {opt.group}
                    </li>
                  ) : null}
                  <li role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onChange(opt.id);
                        setOpen(false);
                      }}
                      className={
                        selected
                          ? `flex w-full items-center text-left text-[var(--foreground)] transition-colors bg-[var(--surface-active)] shadow-[inset_2px_0_0_0_var(--accent)] ${optionClass}`
                          : `flex w-full items-center text-left text-[var(--muted)] transition-colors hover:bg-[var(--surface-highlight-hover)] hover:text-[var(--dream-yellow)] ${optionClass}`
                      }
                    >
                      {opt.label}
                    </button>
                  </li>
                </Fragment>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
