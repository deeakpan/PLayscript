"use client";

import { useMemo } from "react";
import { useConnection } from "wagmi";

/** Deterministic gimmick balance from address (no on-chain read yet). */
function formatMockPlayBalance(address: string): string {
  let h = 0;
  for (let i = 2; i < address.length; i += 1) {
    h = (h * 16 + parseInt(address[i]!, 16)) % 1_000_000;
  }
  const whole = 800 + (h % 12_000);
  const frac = h % 100;
  return `${whole.toLocaleString("en-US")}.${frac.toString().padStart(2, "0")}`;
}

export function PlayBalance() {
  const { address, status } = useConnection();
  const connected = status === "connected";

  const display = useMemo(() => {
    if (!address) return null;
    return formatMockPlayBalance(address);
  }, [address]);

  if (!connected || !address || !display) return null;

  return (
    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-[var(--foreground)]">
      {display}{" "}
      <span className="font-semibold text-[var(--accent)]">$PLAY</span>
    </span>
  );
}
