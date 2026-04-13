// Fixed bounds used for progress chart projection band
export const AGGRESSIVE_KG_PER_WEEK = 0.875;
export const CONSERVATIVE_KG_PER_WEEK = 0.25;

// Legacy label map — only for parsing old stored values
const LEGACY_RATES: Record<string, number> = {
  aggressive:   0.875,
  moderate:     0.5,
  conservative: 0.25,
  maintain:     0,
};

/** Parse the stored weightLossRate string to a kg/week number. */
export function parseRate(rate: string | null): number {
  if (!rate) return 0.5;
  const num = parseFloat(rate);
  if (!isNaN(num)) return num;
  return LEGACY_RATES[rate] ?? 0.5;
}

/** Daily kg loss for the stored rate. */
export function dailyLossKg(rate: string | null): number {
  return parseRate(rate) / 7;
}

/**
 * Projected date of reaching targetWeight from startWeight at the given rate.
 * Returns null if rate is 0, or startWeight is already at/below target.
 */
export function arrivalDate(
  startWeight:  number,
  targetWeight: number,
  rate:         string | null,
  startDate:    Date,
): Date | null {
  const daily = dailyLossKg(rate);
  if (daily <= 0 || startWeight <= targetWeight) return null;
  const days = Math.ceil((startWeight - targetWeight) / daily);
  return new Date(startDate.getTime() + days * 86_400_000);
}
