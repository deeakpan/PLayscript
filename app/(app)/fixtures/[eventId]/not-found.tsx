import Link from "next/link";

export default function FixtureNotFound() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
        Match not found
      </h2>
      <p className="text-sm text-[var(--muted)]">
        That fixture is not available or the event id is invalid.
      </p>
      <Link
        href="/"
        className="inline-flex text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
      >
        Back to fixtures
      </Link>
    </div>
  );
}
