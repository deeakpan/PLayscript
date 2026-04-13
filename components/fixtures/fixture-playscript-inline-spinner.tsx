"use client";

export function FixturePlayscriptInlineSpinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)]/80 bg-[var(--surface)]/50 px-3 py-1.5 text-xs text-[var(--muted)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]/80 animate-pulse [animation-delay:160ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]/60 animate-pulse [animation-delay:320ms]" />
        <span className="ml-1">{label}</span>
      </div>
    </div>
  );
}
