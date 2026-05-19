"use client";

import { useEffect, useState } from "react";

function formatHms(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

type Props = {
  /** Unix seconds when onchain settlement may begin (kickoff + finalize delay). */
  settlementEligibleAtSec: number;
  settled: boolean;
  settleInProgress: boolean;
};

/** Live countdown until the kernel finalize window opens (updates every second). */
export function FixtureV2SettlementCountdown({
  settlementEligibleAtSec,
  settled,
  settleInProgress,
}: Props) {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    if (settled) return;
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [settled]);

  if (settled) return null;

  const secLeft = settlementEligibleAtSec - nowSec;

  if (secLeft > 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Onchain settlement in{" "}
        <span className="font-semibold tabular-nums text-[var(--foreground)]">
          {formatHms(secLeft)}
        </span>
      </p>
    );
  }

  if (settleInProgress) {
    return (
      <p className="text-sm text-amber-200/90">
        Settlement window open — grading onchain…
      </p>
    );
  }

  return (
    <p className="text-sm text-amber-200/90">
      Settlement window open — awaiting onchain grading
    </p>
  );
}
