export const RATE_KG_PER_WEEK: Record<string, number> = {
  aggressive:   0.875, // midpoint of 0.75–1.0
  moderate:     0.5,
  conservative: 0.25,
  maintain:     0,
};

/** Daily kg loss for the selected rate. */
export function dailyLossKg(rate: string | null): number {
  return (RATE_KG_PER_WEEK[rate ?? "moderate"] ?? 0.5) / 7;
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
