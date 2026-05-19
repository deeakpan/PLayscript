/** Human label until `nextClaimAt` ISO string (UTC midnight). */
export function formatTryAgainIn(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const totalMin = Math.ceil(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function alreadyClaimedMessage(nextClaimAt: string | null | undefined): string {
  const inLabel = formatTryAgainIn(nextClaimAt);
  if (inLabel) return `Already claimed today. Try again in ${inLabel}.`;
  return "Already claimed today. Try again after UTC midnight.";
}
