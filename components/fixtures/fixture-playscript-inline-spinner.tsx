"use client";

export function FixturePlayscriptInlineSpinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div
        className="h-9 w-9 shrink-0 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin"
        aria-hidden
      />
      <p className="text-center text-sm text-[var(--muted)]">{label}</p>
    </div>
  );
}
