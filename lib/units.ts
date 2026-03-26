export type UnitSystem = "metric" | "imperial";

const KG_TO_LBS = 2.20462;

/** Convert a stored kg value to the display unit. */
export function kgToDisplay(kg: number, units: UnitSystem): number {
  if (units === "imperial") return Math.round(kg * KG_TO_LBS * 10) / 10;
  return Math.round(kg * 10) / 10;
}

/** Convert a user-entered display value back to kg for storage. */
export function displayToKg(val: number, units: UnitSystem): number {
  if (units === "imperial") return Math.round((val / KG_TO_LBS) * 100) / 100;
  return val;
}

/** The unit label to show next to a weight value. */
export function weightLabel(units: UnitSystem): string {
  return units === "imperial" ? "lbs" : "kg";
}

/** Valid input range for the weight entry field. */
export function weightInputRange(units: UnitSystem): { min: number; max: number; step: number } {
  if (units === "imperial") return { min: 44, max: 880, step: 0.1 };
  return { min: 20, max: 400, step: 0.1 };
}
