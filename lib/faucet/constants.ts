/** Daily PLAY drip per wallet (human units; converted with token decimals on mint). */
export const FAUCET_DAILY_PLAY = "100";

export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Start of next UTC day (when today's claim unlocks). */
export function nextUtcDayStartIso(fromDay = utcDayKey()): string {
  const next = new Date(`${fromDay}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}
