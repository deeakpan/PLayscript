"use client";

import { HIW_TOC_GROUPS } from "@/lib/how-it-works-toc-data";

export function HowItWorksTocPanel({
  activeId,
  onNavigate,
}: {
  activeId: string;
  /** Close mobile drawer after jump. */
  onNavigate?: () => void;
}) {
  return (
    <nav
      aria-label="On this page"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2 pt-1"
    >
      <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        On this page
      </p>
      <div className="flex flex-col gap-4">
        {HIW_TOC_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]/90">
              {group.label}
            </p>
            <ul className="flex flex-col gap-0.5 border-l border-[var(--border)]/80 pl-2">
              {group.items.map((item) => {
                const on = activeId === item.id;
                return (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      onClick={() => onNavigate?.()}
                      className={`block rounded-r-md py-1.5 pl-2 pr-1 text-xs font-medium transition-colors ${
                        on
                          ? "border-l-2 border-[var(--accent)] bg-[var(--surface-active)]/50 text-[var(--foreground)] -ml-px pl-[calc(0.5rem-2px)]"
                          : "border-l-2 border-transparent text-[var(--muted)] hover:text-[var(--dream-yellow)]"
                      }`}
                    >
                      {item.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
