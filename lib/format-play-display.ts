import { formatUnits } from "viem";

/** User-facing PLAY amounts (no wei, limited decimals). */
export function formatPlayAmount(wei: bigint, decimals: number): string {
  const s = formatUnits(wei, decimals);
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
