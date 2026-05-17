import Link from "next/link";

type Props = {
  message: string;
  eventId?: string;
};

export function FixtureEspnUnavailable({ message, eventId }: Props) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        ESPN unavailable
      </p>
      <h1 className="mt-2 text-lg font-semibold text-[var(--foreground)]">Could not load fixture</h1>
      {eventId ? (
        <p className="mt-1 font-mono text-xs text-[var(--muted)]">event {eventId}</p>
      ) : null}
      <p className="mt-4 text-sm leading-relaxed text-rose-200/90">{message}</p>
      <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
        For local dev without ESPN DNS, add{" "}
        <code className="rounded bg-[var(--surface)] px-1 py-0.5 text-[var(--foreground)]">
          ESPN_FIXTURES_DEV_MOCK=1
        </code>{" "}
        to <code className="rounded bg-[var(--surface)] px-1 py-0.5">.env</code> and restart{" "}
        <code className="rounded bg-[var(--surface)] px-1 py-0.5">npm run dev</code>. Known mock events
        include <span className="font-mono text-[var(--accent)]">740902</span> (EPL).
      </p>
      <Link
        href="/"
        className="mt-6 inline-block text-sm font-medium text-[var(--accent)] underline-offset-2 hover:underline"
      >
        Back to fixtures
      </Link>
    </div>
  );
}
