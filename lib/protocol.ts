// Protocol file type and validation.
// Strict numeric structure — all fields required for plan computation.

export interface MacroRange {
  min: number;
  max: number;
}

export interface DayMacros {
  /** Calorie rule relative to maintenance, e.g. -400 means "maintenance - 400" */
  calorie_offset: number;
  /** Whether to add training burn on top of the offset */
  add_training_burn: boolean;
  /** Grams per kg of body weight */
  carbs_g_per_kg: MacroRange;
  protein_g_per_kg: MacroRange;
  fat_g_per_kg: MacroRange;
}

export interface PreRideRules {
  timing_hours_before: number;
  focus: string;
}

export interface OnBikeRules {
  /** Carbs per hour for rides under 90min */
  under_90min_carbs_per_hour: number;
  /** Carbs per hour for rides 90min-3hrs */
  over_90min_carbs_per_hour: MacroRange;
  /** Carbs per hour for rides over 3hrs */
  over_3hrs_carbs_per_hour: MacroRange;
}

export interface PostRideRules {
  timing_minutes_after: number;
  focus: string;
  /** Protein grams per kg within recovery window */
  protein_g_per_kg: number;
  /** Carb grams per kg within recovery window */
  carbs_g_per_kg: number;
}

export interface RaceWeekRules {
  /** How many days before race to start carb loading */
  carb_load_days_before: number;
  /** Carb target during loading phase, g/kg */
  carb_load_g_per_kg: MacroRange;
  /** Race morning carbs, g/kg */
  race_morning_carbs_g_per_kg: number;
  race_morning_hours_before: number;
  strategy_notes: string;
}

export interface ProtocolFile {
  protocol_name: string;
  description: string;
  rest_day: DayMacros;
  training_day: DayMacros;
  pre_ride: PreRideRules;
  on_bike: OnBikeRules;
  post_ride: PostRideRules;
  race_week: RaceWeekRules;
}

type ValidationOk = { valid: true; data: ProtocolFile };
type ValidationFail = { valid: false; error: string };
export type ValidationResult = ValidationOk | ValidationFail;

function isMacroRange(v: unknown): v is MacroRange {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as MacroRange).min === "number" &&
    typeof (v as MacroRange).max === "number"
  );
}

function isDayMacros(v: unknown, field: string): ValidationResult | null {
  if (typeof v !== "object" || v === null) {
    return { valid: false, error: `"${field}" must be an object.` };
  }
  const obj = v as Record<string, unknown>;
  if (typeof obj.calorie_offset !== "number") {
    return { valid: false, error: `"${field}.calorie_offset" must be a number.` };
  }
  if (typeof obj.add_training_burn !== "boolean") {
    return { valid: false, error: `"${field}.add_training_burn" must be a boolean.` };
  }
  if (!isMacroRange(obj.carbs_g_per_kg)) {
    return { valid: false, error: `"${field}.carbs_g_per_kg" must be an object with numeric min and max.` };
  }
  if (!isMacroRange(obj.protein_g_per_kg)) {
    return { valid: false, error: `"${field}.protein_g_per_kg" must be an object with numeric min and max.` };
  }
  if (!isMacroRange(obj.fat_g_per_kg)) {
    return { valid: false, error: `"${field}.fat_g_per_kg" must be an object with numeric min and max.` };
  }
  return null;
}

export function validateProtocol(raw: unknown): ValidationResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { valid: false, error: "Protocol must be a JSON object." };
  }

  const obj = raw as Record<string, unknown>;

  if (!obj.protocol_name || typeof obj.protocol_name !== "string") {
    return { valid: false, error: 'Protocol must include a "protocol_name" string field.' };
  }
  if (obj.protocol_name.trim().length === 0) {
    return { valid: false, error: '"protocol_name" cannot be empty.' };
  }
  if (typeof obj.description !== "string") {
    return { valid: false, error: '"description" must be a string.' };
  }

  const restErr = isDayMacros(obj.rest_day, "rest_day");
  if (restErr) return restErr;

  const trainErr = isDayMacros(obj.training_day, "training_day");
  if (trainErr) return trainErr;

  // pre_ride
  if (typeof obj.pre_ride !== "object" || obj.pre_ride === null) {
    return { valid: false, error: '"pre_ride" must be an object.' };
  }
  const pr = obj.pre_ride as Record<string, unknown>;
  if (typeof pr.timing_hours_before !== "number") {
    return { valid: false, error: '"pre_ride.timing_hours_before" must be a number.' };
  }
  if (typeof pr.focus !== "string") {
    return { valid: false, error: '"pre_ride.focus" must be a string.' };
  }

  // on_bike
  if (typeof obj.on_bike !== "object" || obj.on_bike === null) {
    return { valid: false, error: '"on_bike" must be an object.' };
  }
  const ob = obj.on_bike as Record<string, unknown>;
  if (typeof ob.under_90min_carbs_per_hour !== "number") {
    return { valid: false, error: '"on_bike.under_90min_carbs_per_hour" must be a number.' };
  }
  if (!isMacroRange(ob.over_90min_carbs_per_hour)) {
    return { valid: false, error: '"on_bike.over_90min_carbs_per_hour" must be an object with numeric min and max.' };
  }
  if (!isMacroRange(ob.over_3hrs_carbs_per_hour)) {
    return { valid: false, error: '"on_bike.over_3hrs_carbs_per_hour" must be an object with numeric min and max.' };
  }

  // post_ride
  if (typeof obj.post_ride !== "object" || obj.post_ride === null) {
    return { valid: false, error: '"post_ride" must be an object.' };
  }
  const por = obj.post_ride as Record<string, unknown>;
  if (typeof por.timing_minutes_after !== "number") {
    return { valid: false, error: '"post_ride.timing_minutes_after" must be a number.' };
  }
  if (typeof por.focus !== "string") {
    return { valid: false, error: '"post_ride.focus" must be a string.' };
  }
  if (typeof por.protein_g_per_kg !== "number") {
    return { valid: false, error: '"post_ride.protein_g_per_kg" must be a number.' };
  }
  if (typeof por.carbs_g_per_kg !== "number") {
    return { valid: false, error: '"post_ride.carbs_g_per_kg" must be a number.' };
  }

  // race_week
  if (typeof obj.race_week !== "object" || obj.race_week === null) {
    return { valid: false, error: '"race_week" must be an object.' };
  }
  const rw = obj.race_week as Record<string, unknown>;
  if (typeof rw.carb_load_days_before !== "number") {
    return { valid: false, error: '"race_week.carb_load_days_before" must be a number.' };
  }
  if (!isMacroRange(rw.carb_load_g_per_kg)) {
    return { valid: false, error: '"race_week.carb_load_g_per_kg" must be an object with numeric min and max.' };
  }
  if (typeof rw.race_morning_carbs_g_per_kg !== "number") {
    return { valid: false, error: '"race_week.race_morning_carbs_g_per_kg" must be a number.' };
  }
  if (typeof rw.race_morning_hours_before !== "number") {
    return { valid: false, error: '"race_week.race_morning_hours_before" must be a number.' };
  }
  if (typeof rw.strategy_notes !== "string") {
    return { valid: false, error: '"race_week.strategy_notes" must be a string.' };
  }

  return { valid: true, data: obj as unknown as ProtocolFile };
}
