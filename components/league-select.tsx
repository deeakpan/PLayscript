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
};

export function LeagueSelect({
  options,
  value,
  onChange,
  label = "League",
  showLabel = false,
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

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {showLabel ? (
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          {label}
        </span>
      ) : null}
      <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full min-w-[min(100%,16rem)] items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left text-sm text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,box-shadow,background-color] hover:border-[var(--dream-yellow)]/35 hover:bg-[var(--surface-hover)] focus:border-[var(--accent)]/55 focus:outline-none focus:ring-1 focus:ring-[var(--accent-glow)] sm:w-auto sm:min-w-[14rem]"
      >
        <span className="min-w-0 truncate font-medium">{current?.label ?? "—"}</span>
        {open ? (
          <CaretUp className="h-4 w-4 shrink-0 text-[var(--muted)]" weight="regular" />
        ) : (
          <CaretDown className="h-4 w-4 shrink-0 text-[var(--muted)]" weight="regular" />
        )}
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-activedescendant={value}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg ring-1 ring-black/20"
        >
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
                      ? "flex w-full items-center px-3 py-2.5 text-left text-sm text-[var(--foreground)] transition-colors bg-[var(--surface-active)] shadow-[inset_2px_0_0_0_var(--accent)]"
                      : "flex w-full items-center px-3 py-2.5 text-left text-sm text-[var(--muted)] transition-colors hover:bg-[var(--surface-highlight-hover)] hover:text-[var(--dream-yellow)]"
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
