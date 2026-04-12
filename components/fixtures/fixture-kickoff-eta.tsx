"use client";

import { formatDistanceStrict } from "date-fns";
import { useEffect, useState } from "react";

/** Countdown to kickoff for upcoming fixtures (updates every minute). */
export function FixtureKickoffEta({ kickoffUtc }: { kickoffUtc: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const kick = new Date(kickoffUtc).getTime();
  if (!Number.isFinite(kick) || kick <= now) return null;

  return (
    <p className="text-sm text-[var(--muted)]">
      Kickoff in{" "}
      <span className="font-medium tabular-nums text-[var(--foreground)]">
        {formatDistanceStrict(new Date(kick), new Date(now), { addSuffix: false })}
      </span>
    </p>
  );
}
