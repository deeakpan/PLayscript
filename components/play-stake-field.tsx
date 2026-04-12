"use client";

import { useCallback, useEffect, useMemo } from "react";
import { formatUnits, parseUnits } from "viem";

import { usePlayBalance } from "@/hooks/use-play-balance";

type Props = {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
};

function normalizeOneDot(raw: string): string {
  const s = raw.replace(/[^\d.]/g, "");
  const i = s.indexOf(".");
  if (i === -1) return s;
  return s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, "");
}

function capFractionDigits(s: string, maxDigits: number): string {
  const d = s.indexOf(".");
  if (d === -1 || maxDigits <= 0) return s;
  return s.slice(0, d + 1 + maxDigits);
}

function leadingDotToZero(s: string): string {
  if (s.startsWith(".")) return `0${s}`;
  return s;
}

/** Argument safe for `parseUnits` comparison (not for preserving trailing "."). */
function toParseableUnitsString(s: string): string | null {
  const with0 = leadingDotToZero(normalizeOneDot(s));
  const t = with0.replace(/\.$/, "");
  if (t === "" || t === ".") return null;
  return t;
}

export function PlayStakeField({ value, onChange, disabled }: Props) {
  const { connected, envOk, data, isPending, isFetching, isError, error } = usePlayBalance();
  const loading = isPending || isFetching;

  const balanceLine = useMemo(() => {
    if (!connected) {
      return <span className="text-[var(--muted)]">Connect wallet to see balance.</span>;
    }
    if (!envOk) {
      return <span className="text-[var(--muted)]">Set PLAY token env to load balance.</span>;
    }
    if (loading) {
      return <span className="text-[var(--muted)]">Balance: …</span>;
    }
    if (isError) {
      return (
        <span className="text-rose-300/90" title={error?.message}>
          Balance unavailable
        </span>
      );
    }
    if (!data) return null;
    const formatted = formatUnits(data.raw, data.decimals);
    return (
      <span className="text-[var(--muted)]">
        Balance:{" "}
        <span className="font-mono font-semibold tabular-nums text-[var(--foreground)]">
          {formatted}
        </span>{" "}
        <span className="font-semibold text-[var(--accent)]">$PLAY</span>
      </span>
    );
  }, [connected, envOk, data, loading, isError, error]);

  useEffect(() => {
    if (!data || disabled) return;
    const parseable = toParseableUnitsString(value);
    if (parseable === null) return;
    try {
      const wei = parseUnits(parseable, data.decimals);
      if (wei > data.raw) {
        onChange(formatUnits(data.raw, data.decimals));
      }
    } catch {
      /* ignore partial */
    }
  }, [data, value, onChange, disabled]);

  const handleChange = useCallback(
    (raw: string) => {
      let next = normalizeOneDot(raw.replace(/[^\d.]/g, ""));
      next = leadingDotToZero(next);
      if (data) {
        next = capFractionDigits(next, data.decimals);
        const parseable = toParseableUnitsString(next);
        if (parseable !== null) {
          try {
            const wei = parseUnits(parseable, data.decimals);
            if (wei > data.raw) {
              next = formatUnits(data.raw, data.decimals);
            }
          } catch {
            // keep partial input
          }
        }
      }
      onChange(next);
    },
    [data, onChange],
  );

  return (
    <label className="mt-4 block">
      <span className="text-xs font-medium text-[var(--muted)]">Stake ($PLAY)</span>
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="0"
        className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm tabular-nums outline-none focus:border-[var(--accent)]/50 disabled:opacity-50"
      />
      <p className="mt-1.5 text-[11px] leading-relaxed">{balanceLine}</p>
    </label>
  );
}
