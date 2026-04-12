"use client";

import { formatUnits } from "viem";

import { usePlayBalance } from "@/hooks/use-play-balance";

export function PlayBalance() {
  const { connected, address, envOk, data, isPending, isFetching, isError, error } = usePlayBalance();
  const loading = isPending || isFetching;

  if (!connected || !address) return null;

  if (!envOk) {
    return (
      <span className="max-w-[10rem] truncate text-[10px] text-[var(--muted)] sm:max-w-none sm:text-xs">
        Set PLAY env
      </span>
    );
  }

  if (loading) {
    return (
      <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-[var(--muted)] sm:text-sm">
        … PLAY
      </span>
    );
  }

  if (isError) {
    return (
      <span
        className="max-w-[8rem] truncate text-[10px] text-rose-300/90 sm:max-w-xs sm:text-xs"
        title={error?.message}
      >
        PLAY read err
      </span>
    );
  }

  if (!data) return null;

  const formatted = formatUnits(data.raw, data.decimals);
  const short =
    formatted.includes(".") && formatted.split(".")[1]!.length > 2
      ? `${formatted.split(".")[0]}.${formatted.split(".")[1]!.slice(0, 2)}`
      : formatted;

  return (
    <span
      className="shrink-0 max-w-[7.5rem] truncate font-mono text-xs font-semibold tabular-nums text-[var(--foreground)] sm:max-w-none sm:text-sm"
      title={`${formatted} PLAY`}
    >
      {short}{" "}
      <span className="font-semibold text-[var(--accent)]">PLAY</span>
    </span>
  );
}
